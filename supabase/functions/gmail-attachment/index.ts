// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function decodeB64UrlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function sanitize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("unauthorized", { status: 401, headers: corsHeaders });
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response("unauthorized", { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { attachmentRowId } = await req.json();
    const { data: att, error } = await supabase
      .from("email_attachments")
      .select("id, message_id, filename, mime_type, gmail_attachment_id, storage_path, email_messages(gmail_message_id)")
      .eq("id", attachmentRowId).maybeSingle();
    if (error || !att) return new Response("not found", { status: 404, headers: corsHeaders });

    let storagePath = att.storage_path as string | null;
    if (!storagePath) {
      const gmid = (att as any).email_messages?.gmail_message_id;
      const LOVABLE = Deno.env.get("LOVABLE_API_KEY")!;
      const GMAIL = Deno.env.get("GOOGLE_MAIL_API_KEY")!;
      const r = await fetch(`${GATEWAY}/users/me/messages/${gmid}/attachments/${att.gmail_attachment_id}`, {
        headers: { Authorization: `Bearer ${LOVABLE}`, "X-Connection-Api-Key": GMAIL },
      });
      if (!r.ok) {
        const t = await r.text();
        return new Response(JSON.stringify({ error: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const j = await r.json();
      const bytes = decodeB64UrlToBytes(j.data);
      storagePath = `${att.message_id}/${sanitize(att.filename)}`;
      const { error: upErr } = await supabase.storage.from("email-attachments").upload(storagePath, bytes, {
        upsert: true,
        contentType: att.mime_type || "application/octet-stream",
      });
      if (upErr) throw upErr;
      await supabase.from("email_attachments").update({ storage_path: storagePath }).eq("id", att.id);
    }

    const { data: signed, error: signErr } = await supabase.storage.from("email-attachments").createSignedUrl(storagePath, 300);
    if (signErr) throw signErr;
    return new Response(JSON.stringify({ url: signed.signedUrl, filename: att.filename }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});