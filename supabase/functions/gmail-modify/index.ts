// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("unauthorized", { status: 401, headers: corsHeaders });
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response("unauthorized", { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { messageId, action } = await req.json();
    if (!messageId || !action) return new Response("missing params", { status: 400, headers: corsHeaders });

    const { data: msg } = await supabase.from("email_messages").select("id, gmail_message_id").eq("id", messageId).maybeSingle();
    if (!msg) return new Response("message not found", { status: 404, headers: corsHeaders });

    const LOVABLE = Deno.env.get("LOVABLE_API_KEY")!;
    const GMAIL = Deno.env.get("GOOGLE_MAIL_API_KEY")!;
    const headers = { Authorization: `Bearer ${LOVABLE}`, "X-Connection-Api-Key": GMAIL, "Content-Type": "application/json" };

    let dbPatch: Record<string, any> = {};
    let endpoint = "";
    let body: any = null;

    switch (action) {
      case "mark_read":
        endpoint = `/users/me/messages/${msg.gmail_message_id}/modify`;
        body = { removeLabelIds: ["UNREAD"] };
        dbPatch = { is_read: true };
        break;
      case "mark_unread":
        endpoint = `/users/me/messages/${msg.gmail_message_id}/modify`;
        body = { addLabelIds: ["UNREAD"] };
        dbPatch = { is_read: false };
        break;
      case "star":
        endpoint = `/users/me/messages/${msg.gmail_message_id}/modify`;
        body = { addLabelIds: ["STARRED"] };
        dbPatch = { is_starred: true };
        break;
      case "unstar":
        endpoint = `/users/me/messages/${msg.gmail_message_id}/modify`;
        body = { removeLabelIds: ["STARRED"] };
        dbPatch = { is_starred: false };
        break;
      case "archive":
        endpoint = `/users/me/messages/${msg.gmail_message_id}/modify`;
        body = { removeLabelIds: ["INBOX"] };
        dbPatch = { is_archived: true };
        break;
      case "unarchive":
        endpoint = `/users/me/messages/${msg.gmail_message_id}/modify`;
        body = { addLabelIds: ["INBOX"] };
        dbPatch = { is_archived: false };
        break;
      case "trash":
        endpoint = `/users/me/messages/${msg.gmail_message_id}/trash`;
        dbPatch = { is_trashed: true };
        break;
      case "untrash":
        endpoint = `/users/me/messages/${msg.gmail_message_id}/untrash`;
        dbPatch = { is_trashed: false };
        break;
      default:
        return new Response("unknown action", { status: 400, headers: corsHeaders });
    }

    const r = await fetch(`${GATEWAY}${endpoint}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("gmail modify failed", r.status, t);
      return new Response(JSON.stringify({ error: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("email_messages").update(dbPatch).eq("id", messageId);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});