import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUDIO_TYPES = new Set([
  "whatsapp_incoming_audio",
  "whatsapp_outgoing_audio",
  "whatsapp_audio",
  "audio",
]);

function extToFormat(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "mp3" || e === "mpeg") return "mp3";
  if (e === "m4a" || e === "mp4" || e === "aac") return "mp4";
  if (e === "wav") return "wav";
  if (e === "webm") return "webm";
  return "ogg";
}

function mimeToFormat(mime: string | null): string {
  if (!mime) return "ogg";
  const m = mime.toLowerCase();
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4") || m.includes("aac") || m.includes("m4a")) return "mp4";
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  return "ogg";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { message_id } = await req.json().catch(() => ({}));
    if (!message_id) {
      return new Response(JSON.stringify({ error: "message_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: msg, error: fetchErr } = await sb
      .from("chat_messages")
      .select("id, message_type, media_url, transcription, transcription_status")
      .eq("id", message_id)
      .single();

    if (fetchErr || !msg) {
      return new Response(JSON.stringify({ error: "message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!AUDIO_TYPES.has(msg.message_type) || !msg.media_url) {
      await sb
        .from("chat_messages")
        .update({ transcription_status: "unsupported" })
        .eq("id", message_id);
      return new Response(JSON.stringify({ ok: true, skipped: "not_audio" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (msg.transcription_status === "done" && msg.transcription) {
      return new Response(JSON.stringify({ ok: true, cached: true, transcription: msg.transcription }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb
      .from("chat_messages")
      .update({ transcription_status: "processing" })
      .eq("id", message_id);

    // Download audio
    const audioRes = await fetch(msg.media_url);
    if (!audioRes.ok) {
      await sb
        .from("chat_messages")
        .update({ transcription_status: "failed" })
        .eq("id", message_id);
      return new Response(JSON.stringify({ error: "failed to download audio" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mime = audioRes.headers.get("content-type");
    const buf = new Uint8Array(await audioRes.arrayBuffer());
    const base64 = bytesToBase64(buf);

    const urlExt = (msg.media_url.split("?")[0].split(".").pop() || "").toLowerCase();
    const format = mime ? mimeToFormat(mime) : extToFormat(urlExt);

    // Call Lovable AI Gateway with Gemini (multimodal audio input)
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um transcritor de áudio. Transcreva LITERALMENTE o áudio em português brasileiro. Não adicione comentários, prefixos, explicações ou pontuação extra. Se não houver fala, responda apenas: [áudio sem fala]",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva este áudio:" },
              {
                type: "input_audio",
                input_audio: { data: base64, format },
              },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      await sb
        .from("chat_messages")
        .update({ transcription_status: "failed" })
        .eq("id", message_id);
      const code = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500;
      return new Response(JSON.stringify({ error: "AI gateway error", status: aiRes.status }), {
        status: code,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const transcription: string = (aiData?.choices?.[0]?.message?.content || "").toString().trim();

    if (!transcription) {
      await sb
        .from("chat_messages")
        .update({ transcription_status: "failed" })
        .eq("id", message_id);
      return new Response(JSON.stringify({ error: "empty transcription" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb
      .from("chat_messages")
      .update({ transcription, transcription_status: "done" })
      .eq("id", message_id);

    return new Response(JSON.stringify({ ok: true, transcription }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("transcribe error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});