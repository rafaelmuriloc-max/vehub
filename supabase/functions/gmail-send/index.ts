// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function b64url(s: string): string {
  // s is binary string
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function utf8ToBinaryString(s: string) {
  const bytes = new TextEncoder().encode(s);
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

function buildMime(opts: {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  html?: string;
  text?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: { filename: string; mime: string; base64: string }[];
}) {
  const boundary = "==boundary_" + crypto.randomUUID().replace(/-/g, "");
  const altBoundary = "==alt_" + crypto.randomUUID().replace(/-/g, "");
  const headers: string[] = [];
  headers.push(`From: ${opts.from}`);
  headers.push(`To: ${opts.to.join(", ")}`);
  if (opts.cc?.length) headers.push(`Cc: ${opts.cc.join(", ")}`);
  headers.push(`Subject: =?UTF-8?B?${btoa(utf8ToBinaryString(opts.subject))}?=`);
  headers.push("MIME-Version: 1.0");
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) headers.push(`References: ${opts.references}`);

  const hasAttachments = (opts.attachments?.length || 0) > 0;

  const altBody = [
    `--${altBoundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    "",
    btoa(utf8ToBinaryString(opts.text || opts.html?.replace(/<[^>]+>/g, "") || "")),
    "",
    `--${altBoundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    "",
    btoa(utf8ToBinaryString(opts.html || `<pre>${opts.text || ""}</pre>`)),
    "",
    `--${altBoundary}--`,
  ].join("\r\n");

  if (!hasAttachments) {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    return headers.join("\r\n") + "\r\n\r\n" + altBody;
  }

  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  const parts: string[] = [];
  parts.push(`--${boundary}`);
  parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
  parts.push("");
  parts.push(altBody);
  for (const att of opts.attachments!) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: ${att.mime}; name="${att.filename}"`);
    parts.push("Content-Transfer-Encoding: base64");
    parts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
    parts.push("");
    // Wrap base64 lines at 76 chars
    parts.push(att.base64.replace(/(.{76})/g, "$1\r\n"));
  }
  parts.push(`--${boundary}--`);
  return headers.join("\r\n") + "\r\n\r\n" + parts.join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { to, cc, subject, html, text, inReplyTo, references, threadId, attachments } = body as {
      to: string[]; cc?: string[]; subject: string; html?: string; text?: string;
      inReplyTo?: string; references?: string; threadId?: string;
      attachments?: { storage_path: string; filename: string; mime: string }[];
    };
    if (!to?.length || !subject) return new Response(JSON.stringify({ error: "to and subject required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: settings } = await supabase.from("company_settings").select("gmail_connected_email").limit(1).maybeSingle();
    const from = settings?.gmail_connected_email;
    if (!from) return new Response(JSON.stringify({ error: "Gmail not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Load attachment bytes
    const attMime: { filename: string; mime: string; base64: string }[] = [];
    for (const a of attachments || []) {
      const { data: blob, error } = await supabase.storage.from("email-attachments").download(a.storage_path);
      if (error || !blob) throw new Error(`attachment download failed: ${a.storage_path}`);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (const b of buf) bin += String.fromCharCode(b);
      attMime.push({ filename: a.filename, mime: a.mime, base64: btoa(bin) });
    }

    const mime = buildMime({ from, to, cc, subject, html, text, inReplyTo, references, attachments: attMime });
    const raw = b64url(mime);

    const LOVABLE = Deno.env.get("LOVABLE_API_KEY")!;
    const GMAIL = Deno.env.get("GOOGLE_MAIL_API_KEY")!;
    const sendRes = await fetch(`${GATEWAY}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE}`,
        "X-Connection-Api-Key": GMAIL,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw, threadId }),
    });
    const sendJson = await sendRes.json();
    if (!sendRes.ok) {
      console.error("gmail send failed", sendJson);
      return new Response(JSON.stringify({ error: "gmail send failed", detail: sendJson }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Trigger a sync to pull the sent message
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
    }).catch(() => {});

    return new Response(JSON.stringify({ ok: true, id: sendJson.id, threadId: sendJson.threadId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("gmail-send error", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});