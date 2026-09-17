import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.98.0/cors";

const APP_URL = "https://vehub.lovable.app";

/** Senha temporária forte: 12 caracteres com maiúsculas, minúsculas, dígitos e símbolo. */
function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = 0; i < 8; i++) chars.push(pick(all));
  // Embaralha (Fisher-Yates)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Normaliza para o formato internacional do WhatsApp (E.164 em dígitos, com DDI 55). */
function normalizeWhatsApp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  d = d.replace(/^0+/, "");
  if (!d) return null;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d.length >= 10 ? d : null;
}

// Resolve o JID correto do número na Evolution (muitos números BR sem o 9º dígito).
async function resolveEvolutionNumber(
  evoUrl: string,
  apiKey: string,
  instance: string,
  phoneDigits: string,
): Promise<{ number: string | null; exists: boolean; error?: string }> {
  const variants = new Set<string>([phoneDigits]);
  if (phoneDigits.length === 13 && phoneDigits.startsWith("55") && phoneDigits[4] === "9") {
    variants.add(phoneDigits.slice(0, 4) + phoneDigits.slice(5));
  }
  if (phoneDigits.length === 12 && phoneDigits.startsWith("55")) {
    const localFirst = phoneDigits[4];
    if (["6", "7", "8", "9"].includes(localFirst)) {
      variants.add(phoneDigits.slice(0, 4) + "9" + phoneDigits.slice(4));
    }
  }
  try {
    const r = await fetch(`${evoUrl}/chat/whatsappNumbers/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ numbers: [...variants] }),
    });
    if (!r.ok) {
      return { number: phoneDigits, exists: true, error: `lookup ${r.status}` };
    }
    const arr = await r.json().catch(() => [] as any[]);
    const hit = (Array.isArray(arr) ? arr : []).find((x: any) => x?.exists);
    if (!hit) return { number: null, exists: false };
    const jid: string = hit.jid || "";
    const num = jid.includes("@") ? jid.split("@")[0] : (hit.number || phoneDigits);
    return { number: num, exists: true };
  } catch (e) {
    console.error("resolveEvolutionNumber error:", e);
    return { number: phoneDigits, exists: true, error: String(e) };
  }
}

/** Envia texto pelo WhatsApp do escritório (Evolution API). Retorna erro descritivo quando falha. */
async function sendWhatsAppText(phoneDigits: string, text: string): Promise<{ sent: boolean; error?: string }> {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
  const evolutionInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");
  if (!evolutionUrl || !evolutionApiKey || !evolutionInstance) {
    return { sent: false, error: "WhatsApp do escritório não está configurado" };
  }
  const resolved = await resolveEvolutionNumber(evolutionUrl, evolutionApiKey, evolutionInstance, phoneDigits);
  if (!resolved.exists || !resolved.number) {
    return { sent: false, error: "Número de WhatsApp não encontrado" };
  }
  try {
    const r = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
      body: JSON.stringify({ number: resolved.number, text }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return { sent: false, error: `Falha no envio (${r.status})` + (detail ? `: ${detail.slice(0, 200)}` : "") };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: String(e) };
  }
}

function accessMessage(email: string, tempPassword: string, name?: string | null): string {
  const who = name ? `Olá, ${name}!` : "Olá!";
  return [
    `🔐 ${who} Seu acesso ao sistema Velocitä está pronto.`,
    "",
    `E-mail: ${email}`,
    `Senha temporária: ${tempPassword}`,
    "",
    `Acesse ${APP_URL} e troque a senha no primeiro login.`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = claimsData.claims.sub as string;

    // Check admin role
    const { data: roleCheck } = await anonClient.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    if (action === "create" || action === "invite") {
      const { email, password, full_name, job_title, department_id, department_ids, role, tag_color, whatsapp } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (typeof password !== "string" || password.length < 6) {
        return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || email },
      });

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const userId = created.user.id;

      const deptList: string[] = Array.isArray(department_ids)
        ? department_ids.filter((x: unknown) => typeof x === "string" && x.length > 0)
        : (department_id ? [department_id] : []);
      const primaryDept = deptList[0] ?? null;

      // Update profile (created by trigger handle_new_user)
      await adminClient.from("profiles").update({
        job_title: job_title || null,
        department_id: primaryDept,
        must_change_password: true,
        ...(tag_color !== undefined ? { tag_color: tag_color || null } : {}),
      }).eq("user_id", userId);

      if (deptList.length > 0) {
        await adminClient.from("profile_departments").insert(
          deptList.map((d) => ({ user_id: userId, department_id: d }))
        );
      }

      // Update role if admin
      if (role === "admin") {
        await adminClient.from("user_roles").update({ role: "admin" }).eq("user_id", userId);
      }

      // Envia o acesso por WhatsApp (quando informado)
      let whatsapp_sent = false;
      let whatsapp_error: string | null = null;
      const phone = normalizeWhatsApp(whatsapp);
      if (phone) {
        const send = await sendWhatsAppText(phone, accessMessage(email, password, full_name || null));
        whatsapp_sent = send.sent;
        whatsapp_error = send.error ?? null;
      }

      return new Response(JSON.stringify({ success: true, user_id: userId, whatsapp_sent, whatsapp_error }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "send-access") {
      const { user_id, whatsapp } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const phone = normalizeWhatsApp(whatsapp);
      if (!phone) {
        return new Response(JSON.stringify({ error: "Informe um número de WhatsApp válido (com DDD)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: target, error: targetErr } = await adminClient.auth.admin.getUserById(user_id);
      if (targetErr || !target?.user?.email) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const email = target.user.email;
      const fullName = (target.user.user_metadata?.full_name as string) || null;

      // Nova senha temporária substitui a anterior
      const tempPassword = generateTempPassword();
      const { error: pwdErr } = await adminClient.auth.admin.updateUserById(user_id, { password: tempPassword });
      if (pwdErr) {
        return new Response(JSON.stringify({ error: pwdErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await adminClient.from("profiles").update({ must_change_password: true }).eq("user_id", user_id);

      const send = await sendWhatsAppText(phone, accessMessage(email, tempPassword, fullName));
      return new Response(JSON.stringify({
        success: true,
        temp_password: tempPassword,
        whatsapp_sent: send.sent,
        whatsapp_error: send.error ?? null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { user_id, full_name, job_title, department_id, department_ids, role, tag_color, hourly_rate } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const profileUpdate: Record<string, unknown> = {};
      if (full_name !== undefined) profileUpdate.full_name = full_name || null;
      if (job_title !== undefined) profileUpdate.job_title = job_title || null;
      if (tag_color !== undefined) profileUpdate.tag_color = tag_color || null;
      if (hourly_rate !== undefined) {
        const rate = typeof hourly_rate === "number" && Number.isFinite(hourly_rate) && hourly_rate >= 0 ? hourly_rate : null;
        profileUpdate.hourly_rate = rate;
      }

      let deptList: string[] | null = null;
      if (Array.isArray(department_ids)) {
        deptList = department_ids.filter((x: unknown) => typeof x === "string" && x.length > 0);
      } else if (department_id !== undefined) {
        deptList = department_id ? [department_id] : [];
      }
      if (deptList !== null) {
        profileUpdate.department_id = deptList[0] ?? null;
      }

      if (Object.keys(profileUpdate).length > 0) {
        await adminClient.from("profiles").update(profileUpdate).eq("user_id", user_id);
      }

      if (deptList !== null) {
        await adminClient.from("profile_departments").delete().eq("user_id", user_id);
        if (deptList.length > 0) {
          await adminClient.from("profile_departments").insert(
            deptList.map((d) => ({ user_id, department_id: d }))
          );
        }
      }

      if (role === "admin" || role === "employee") {
        await adminClient.from("user_roles").update({ role }).eq("user_id", user_id);
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (user_id === callerId) {
        return new Response(JSON.stringify({ error: "Cannot delete yourself" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
