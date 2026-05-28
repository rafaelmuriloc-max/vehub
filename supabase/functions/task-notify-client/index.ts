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

function formatCnpj(raw?: string | null): string {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5");
}

function formatDateBR(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00:00" : iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  } catch { return ""; }
}

function applyTemplateVars(text: string, vars: Record<string, string>): string {
  if (!text) return text;
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) lower[k.toLowerCase()] = v ?? "";
  return text.replace(/\{\{\s*([\w_]+)\s*\}\}/gi, (_m, name) => {
    const v = lower[String(name).toLowerCase()];
    return v === undefined ? "" : v;
  });
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
      .select("id, title, description, due_date, created_by, client_id, department_id, notify_whatsapp, notify_email, notify_message, notify_email_subject, notify_sent_at")
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

    const rawMessage: string = (task.notify_message || "").trim();
    if (!rawMessage) {
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
    let clientName = "";
    let clientCnpj = "";
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
    if (task.client_id) {
      const { data: c } = await admin
        .from("clients")
        .select("contact_phone, contact_email, company_name, document")
        .eq("id", task.client_id)
        .maybeSingle();
      if (c) {
        if (!phone) phone = c.contact_phone || null;
        if (!email) email = c.contact_email || null;
        clientName = c.company_name || "";
        clientCnpj = formatCnpj((c as any).document);
      }
    }

    // Quem concluiu = usuário autenticado que disparou a notificação
    let responsavel = "";
    {
      const { data: prof } = await admin
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      responsavel = (prof as any)?.full_name || "";
      if (!responsavel && task.created_by) {
        const { data: prof2 } = await admin
          .from("profiles")
          .select("full_name")
          .eq("user_id", task.created_by)
          .maybeSingle();
        responsavel = (prof2 as any)?.full_name || "";
      }
    }

    const templateVars: Record<string, string> = {
      cliente: clientName,
      cnpj: clientCnpj,
      tarefa: task.title || "",
      vencimento: formatDateBR(task.due_date),
      descricao: (task as any).description || "",
      responsavel,
      data_hoje: new Date().toLocaleDateString("pt-BR"),
      competencia: "",
    };
    const message = applyTemplateVars(rawMessage, templateVars);
    const signedMessage = responsavel ? `*${responsavel}*\n\n${message}` : message;

    const result: Record<string, any> = { whatsapp: null, email: null };

    // Resolve or create the chat conversation for this client/phone so each WhatsApp send
    // can be reflected as a chat_messages row (otherwise nothing shows in the internal chat).
    async function ensureConversation(toPhone: string): Promise<string | null> {
      try {
        if (task.client_id) {
          const { data: byClient } = await admin
            .from("chat_conversations")
            .select("id")
            .eq("client_id", task.client_id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (byClient?.id) return byClient.id;
        }
        const { data: byPhone } = await admin
          .from("chat_conversations")
          .select("id")
          .eq("whatsapp_phone", toPhone)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byPhone?.id) return byPhone.id;
        const { data: created, error: createErr } = await admin
          .from("chat_conversations")
          .insert({
            name: clientName || toPhone,
            whatsapp_phone: toPhone,
            client_id: task.client_id || null,
            created_by: user.id,
            status: "open",
          })
          .select("id")
          .single();
        if (createErr) {
          console.log("ensureConversation insert error:", createErr.message);
          return null;
        }
        return created?.id || null;
      } catch (e: any) {
        console.log("ensureConversation error:", e.message);
        return null;
      }
    }

    // ---------- WhatsApp via Evolution API ----------
    if (task.notify_whatsapp) {
      const EVO_URL = Deno.env.get("EVOLUTION_API_URL");
      const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY");
      const EVO_INST = Deno.env.get("EVOLUTION_INSTANCE_NAME");
      const to = normalizePhone(phone);
      if (!EVO_URL || !EVO_KEY || !EVO_INST) {
        result.whatsapp = { ok: false, error: "Evolution API não configurada" };
      } else if (!to) {
        result.whatsapp = { ok: false, error: "Cliente sem telefone" };
      } else {
        const errors: string[] = [];
        const conversationId = await ensureConversation(to);
        const remoteJid = `${to}@s.whatsapp.net`;
        const guessMime = (name: string, type?: string | null): string => {
          if (type) return type;
          const ext = (name || "").split(".").pop()?.toLowerCase() || "";
          const map: Record<string, string> = {
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            zip: "application/zip",
            txt: "text/plain",
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
          };
          return map[ext] || "application/octet-stream";
        };

        // 1. Texto via Evolution
        try {
          const r = await fetch(`${EVO_URL}/message/sendText/${EVO_INST}`, {
            method: "POST",
            headers: { apikey: EVO_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ number: to, text: signedMessage }),
          });
          const j = await r.json().catch(() => ({}));
          const waId = j?.key?.id || null;
          console.log("Evolution sendText status:", r.status, "id:", waId, "err:", r.ok ? null : (j?.message || null));
          if (!r.ok) {
            errors.push(`texto: ${j?.message || `HTTP ${r.status}`}`);
          } else {
            await admin.from("whatsapp_logs").insert({
              client_id: task.client_id || null,
              instance_id: null,
              recipient_phone: to,
              template_name: null,
              template_params: null,
              body_text: signedMessage,
              status: "sent",
              wamid: waId,
              sent_by: user.id,
            });
            if (conversationId) {
              await admin.from("chat_messages").insert({
                conversation_id: conversationId,
                sender_id: user.id,
                content: signedMessage,
                message_type: "whatsapp_outgoing",
                channel: "whatsapp",
                wa_message_id: waId,
                wa_evolution_id: waId,
                wa_remote_jid: remoteJid,
                agent_name: responsavel || null,
              });
            }
          }
        } catch (e: any) {
          errors.push(`texto: ${e.message}`);
        }

        // 2. Cada anexo via Evolution
        for (const att of attachments) {
          const { data: signed } = await admin.storage.from("documents").createSignedUrl(att.file_url, 604800);
          if (!signed?.signedUrl) { errors.push(`${att.file_name}: url`); continue; }
          const isImage = (att.file_type || "").startsWith("image/");
          try {
            const r = await fetch(`${EVO_URL}/message/sendMedia/${EVO_INST}`, {
              method: "POST",
              headers: { apikey: EVO_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({
                number: to,
                mediatype: isImage ? "image" : "document",
                mimetype: guessMime(att.file_name, att.file_type),
                media: signed.signedUrl,
                fileName: att.file_name,
              }),
            });
            const j = await r.json().catch(() => ({}));
            const waId = j?.key?.id || null;
            console.log(`Evolution sendMedia (${att.file_name}) status:`, r.status, "id:", waId, "err:", r.ok ? null : (j?.message || null));
            if (!r.ok) {
              errors.push(`${att.file_name}: ${j?.message || `HTTP ${r.status}`}`);
            } else {
              await admin.from("whatsapp_logs").insert({
                client_id: task.client_id || null,
                instance_id: null,
                recipient_phone: to,
                template_name: null,
                template_params: null,
                body_text: att.file_name,
                status: "sent",
                wamid: waId,
                sent_by: user.id,
              });
              if (conversationId) {
                await admin.from("chat_messages").insert({
                  conversation_id: conversationId,
                  sender_id: user.id,
                  content: att.file_name,
                  message_type: isImage ? "whatsapp_image" : "whatsapp_document",
                  channel: "whatsapp",
                  media_url: signed.signedUrl,
                  wa_message_id: waId,
                  wa_evolution_id: waId,
                  wa_remote_jid: remoteJid,
                  agent_name: responsavel || null,
                });
              }
            }
          } catch (e: any) {
            errors.push(`${att.file_name}: ${e.message}`);
          }
        }
        if (conversationId) {
          await admin
            .from("chat_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId);
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
        const subjectRaw = (task.notify_email_subject || `Documentos da tarefa: ${task.title}`).trim();
        const subject = applyTemplateVars(subjectRaw, templateVars);
        const signatureHtml = responsavel
          ? `<p><strong>${escapeHtml(responsavel)}</strong></p>`
          : "";
        const html = `${signatureHtml}<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`;
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