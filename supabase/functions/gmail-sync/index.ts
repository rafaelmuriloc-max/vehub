// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function gheaders() {
  const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
  const GMAIL = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!LOVABLE) throw new Error("LOVABLE_API_KEY missing");
  if (!GMAIL) throw new Error("GOOGLE_MAIL_API_KEY missing");
  return {
    Authorization: `Bearer ${LOVABLE}`,
    "X-Connection-Api-Key": GMAIL,
    "Content-Type": "application/json",
  };
}

async function gfetch(path: string) {
  const r = await fetch(`${GATEWAY}${path}`, { headers: gheaders() });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Gmail ${path} [${r.status}]: ${t}`);
  }
  return r.json();
}

function decodeBase64Url(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function getHeader(headers: any[], name: string): string | undefined {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function parseAddresses(s?: string): string[] {
  if (!s) return [];
  return s.split(",").map((p) => {
    const m = p.match(/<([^>]+)>/);
    return (m ? m[1] : p).trim();
  }).filter(Boolean);
}

function parseFromAddress(s?: string): { email: string; name: string } {
  if (!s) return { email: "", name: "" };
  const m = s.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, "").trim(), email: m[2].trim() };
  return { email: s.trim(), name: "" };
}

type Part = { mimeType: string; body?: { data?: string; attachmentId?: string; size?: number }; parts?: Part[]; filename?: string };

function walkParts(part: Part, out: { html: string; text: string; attachments: { filename: string; mime: string; size: number; attachmentId: string }[] }) {
  if (!part) return;
  if (part.parts && part.parts.length) {
    for (const p of part.parts) walkParts(p, out);
    return;
  }
  if (part.filename && part.body?.attachmentId) {
    out.attachments.push({
      filename: part.filename,
      mime: part.mimeType || "application/octet-stream",
      size: part.body.size || 0,
      attachmentId: part.body.attachmentId,
    });
    return;
  }
  if (part.body?.data) {
    const text = decodeBase64Url(part.body.data);
    if (part.mimeType === "text/html") out.html += text;
    else if (part.mimeType === "text/plain") out.text += text;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: settings, error: settingsErr } = await supabase
      .from("company_settings")
      .select("id, gmail_last_history_id, gmail_connected_email")
      .limit(1).maybeSingle();
    if (settingsErr) throw settingsErr;
    if (!settings) {
      return new Response(JSON.stringify({ ok: false, error: "company_settings not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Read profile to capture e-mail
    const profile = await gfetch(`/users/me/profile`);
    const connectedEmail = profile.emailAddress as string;
    const latestHistoryId = profile.historyId as string;

    let messageIds: string[] = [];
    let useIncremental = !!settings.gmail_last_history_id;

    if (useIncremental) {
      try {
        let pageToken: string | undefined;
        do {
          const url = `/users/me/history?startHistoryId=${settings.gmail_last_history_id}&historyTypes=messageAdded${pageToken ? `&pageToken=${pageToken}` : ""}`;
          const h: any = await gfetch(url);
          for (const entry of h.history || []) {
            for (const ma of entry.messagesAdded || []) {
              if (ma.message?.id) messageIds.push(ma.message.id);
            }
          }
          pageToken = h.nextPageToken;
        } while (pageToken);
      } catch (e) {
        console.warn("history.list failed, fallback to messages.list", e);
        useIncremental = false;
      }
    }

    if (!useIncremental) {
      // initial / fallback: last 30 days, max 100
      const list: any = await gfetch(`/users/me/messages?q=newer_than:30d&maxResults=100`);
      messageIds = (list.messages || []).map((m: any) => m.id);
    }

    // Dedup against DB
    let toFetch = messageIds;
    if (toFetch.length) {
      const { data: existing } = await supabase
        .from("email_messages")
        .select("gmail_message_id")
        .in("gmail_message_id", toFetch);
      const set = new Set((existing || []).map((r: any) => r.gmail_message_id));
      toFetch = toFetch.filter((id) => !set.has(id));
    }

    let inserted = 0;
    for (const mid of toFetch) {
      try {
        const full: any = await gfetch(`/users/me/messages/${mid}?format=full`);
        const headers = full.payload?.headers || [];
        const subject = getHeader(headers, "Subject") || "(sem assunto)";
        const fromRaw = getHeader(headers, "From");
        const toRaw = getHeader(headers, "To");
        const ccRaw = getHeader(headers, "Cc");
        const dateRaw = getHeader(headers, "Date");
        const from = parseFromAddress(fromRaw);
        const labels: string[] = full.labelIds || [];
        const isSent = labels.includes("SENT");
        const isRead = !labels.includes("UNREAD");
        const isStarred = labels.includes("STARRED");
        const isArchived = !labels.includes("INBOX") && !labels.includes("TRASH") && !isSent;
        const isTrashed = labels.includes("TRASH");

        const acc = { html: "", text: "", attachments: [] as any[] };
        walkParts(full.payload as Part, acc);

        const receivedAt = dateRaw ? new Date(dateRaw).toISOString() : new Date(Number(full.internalDate || Date.now())).toISOString();

        const { data: ins, error: insErr } = await supabase
          .from("email_messages")
          .insert({
            gmail_message_id: mid,
            gmail_thread_id: full.threadId,
            from_email: from.email,
            from_name: from.name,
            to_emails: parseAddresses(toRaw),
            cc_emails: parseAddresses(ccRaw),
            subject,
            snippet: full.snippet || "",
            body_html: acc.html || null,
            body_text: acc.text || null,
            received_at: receivedAt,
            is_read: isRead,
            is_starred: isStarred,
            is_archived: isArchived,
            is_trashed: isTrashed,
            is_sent: isSent,
            has_attachments: acc.attachments.length > 0,
            labels,
          })
          .select("id").single();
        if (insErr) { console.error("insert err", mid, insErr); continue; }

        if (acc.attachments.length) {
          await supabase.from("email_attachments").insert(
            acc.attachments.map((a) => ({
              message_id: ins.id,
              filename: a.filename,
              mime_type: a.mime,
              size_bytes: a.size,
              gmail_attachment_id: a.attachmentId,
            })),
          );
        }
        inserted++;
      } catch (e) {
        console.error("message fetch failed", mid, e);
      }
    }

    await supabase
      .from("company_settings")
      .update({
        gmail_connected_email: connectedEmail,
        gmail_last_history_id: latestHistoryId,
        gmail_last_sync_at: new Date().toISOString(),
      })
      .eq("id", settings.id);

    return new Response(
      JSON.stringify({ ok: true, candidates: messageIds.length, inserted, email: connectedEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("gmail-sync error", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});