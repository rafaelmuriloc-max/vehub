import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(p?: string | null): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAuth = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { taskId } = await req.json();
    if (!taskId) {
      return new Response(JSON.stringify({ error: "taskId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: task, error: taskErr } = await admin
      .from("tasks")
      .select("id, title, client_id, department_id, notify_whatsapp, notify_email, notify_message, notify_email_subject, notify_sent_at")
      .eq("id", taskId)
      .single();
    if (taskErr || !task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!task.notify_whatsapp && !task.notify_email) {
      return new Response(JSON.stringify({ skipped: true, reason: "no channel" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message: string = (task.notify_message || "").trim();
    if (!message) {
      return new Response(JSON.stringify({ error: "notify_message vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Output attachments
    const { data: atts } = await admin
      .from("task_attachments")
      .select("file_url, file_name, file_type")
      .eq("task_id", taskId)
      .eq("direction", "output");
    const attachments = atts || [];

    // Client contact resolution (department-specific first, fallback client)
    let phone: string | null = null;
    let email: string | null = null;
    if (task.client_id && task.department_id) {
      const { data: dc } = await admin
        .from("client_department_contacts")
        .select("contact_phone, contact_email")
        .eq("client_id", task.client_id)
        .eq("department_id", task.department_id)
        .limit(1)
        .maybeSingle();
      if (dc) {
        phone = dc.contact_phone || null;
        email = dc.contact_email || null;
      }
    }
    if (task.client_id && (!phone || !email)) {
      const { data: c } = await admin
        .from("clients")
        .select("contact_phone, contact_email")
        .eq("id", task.client_id)
        .maybeSingle();
      if (c) {
        if (!phone) phone = c.contact_phone || null;
        if (!email) email = c.contact_email || null;
      }
    }

    const result: Record<string, any> = { whatsapp: null, email: null };

    // ---------- WhatsApp via Meta Cloud API ----------
    if (task.notify_whatsapp) {
      const TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      const to = normalizePhone(phone);
      if (!TOKEN || !PHONE_ID) {
        result.whatsapp = { ok: false, error: "WhatsApp não configurado" };
      } else if (!to) {
        result.whatsapp = { ok: false, error: "Cliente sem telefone" };
      } else {
        const errors: string[] = [];
        // Text message
        try {
          const r = await fetch(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "text",
              text: { body: message },
            }),
          });
          if (!r.ok) errors.push(`texto: ${await r.text()}`);
        } catch (e: any) {
          errors.push(`texto: ${e.message}`);
        }
        // Each attachment as document
        for (const att of attachments) {
          const { data: signed } = await admin.storage.from("documents").createSignedUrl(att.file_url, 86400);
          if (!signed?.signedUrl) { errors.push(`${att.file_name}: url`); continue; }
          const isImage = (att.file_type || "").startsWith("image/");
          const body = isImage
            ? { messaging_product: "whatsapp", to, type: "image", image: { link: signed.signedUrl } }
            : { messaging_product: "whatsapp", to, type: "document", document: { link: signed.signedUrl, filename: att.file_name } };
          try {
            const r = await fetch(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
              body: JSON.stringify(body),
            });
            if (!r.ok) errors.push(`${att.file_name}: ${await r.text()}`);
          } catch (e: any) {
            errors.push(`${att.file_name}: ${e.message}`);
          }
        }
        result.whatsapp = errors.length === 0 ? { ok: true } : { ok: false, error: errors.join(" | ") };
      }
    }

    // ---------- Email via smtp-send ----------
    if (task.notify_email) {
      if (!email) {
        result.email = { ok: false, error: "Cliente sem e-mail" };
      } else if (!task.department_id) {
        result.email = { ok: false, error: "Tarefa sem departamento" };
      } else {
        const subject = (task.notify_email_subject || `Documentos da tarefa: ${task.title}`).trim();
        const html = `<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`;
        const emailAttachments = attachments.map(a => ({ fileUrl: a.file_url, fileName: a.file_name }));
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/smtp-send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader },
            body: JSON.stringify({
              departmentId: task.department_id,
              to: email,
              subject,
              html,
              attachments: emailAttachments,
            }),
          });
          const j = await r.json().catch(() => ({}));
          result.email = r.ok ? { ok: true } : { ok: false, error: j.error || `HTTP ${r.status}` };
        } catch (e: any) {
          result.email = { ok: false, error: e.message };
        }
      }
    }

    const anyOk =
      (result.whatsapp && result.whatsapp.ok) ||
      (result.email && result.email.ok);
    if (anyOk) {
      await admin.from("tasks").update({ notify_sent_at: new Date().toISOString() }).eq("id", taskId);
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("task-notify-client error:", e);
    return new Response(JSON.stringify({ error: e.message || "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});