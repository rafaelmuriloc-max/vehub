import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function onlyDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

async function resolveEvolutionNumber(
  evoUrl: string,
  apiKey: string,
  instance: string,
  phoneDigits: string,
): Promise<{ number: string | null; exists: boolean }> {
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
    if (!r.ok) return { number: phoneDigits, exists: true };
    const arr = await r.json().catch(() => [] as any[]);
    const hit = (Array.isArray(arr) ? arr : []).find((x: any) => x?.exists);
    if (!hit) return { number: null, exists: false };
    const jid: string = hit.jid || "";
    const num = jid.includes("@") ? jid.split("@")[0] : (hit.number || phoneDigits);
    return { number: num, exists: true };
  } catch {
    return { number: phoneDigits, exists: true };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { instance_id } = body || {};
    if (!instance_id) return json({ error: "instance_id obrigatório" }, 400);

    // Load instance + obligation + client + office
    const { data: inst, error: instErr } = await admin
      .from("obligation_instances")
      .select("id, client_id, obligation_id, reference_month, status")
      .eq("id", instance_id)
      .maybeSingle();
    if (instErr || !inst) return json({ error: "Instância não encontrada" }, 404);

    const [{ data: obl }, { data: client }, { data: settings }] = await Promise.all([
      admin.from("obligations").select("id, name, competence_rule, system_code").eq("id", inst.obligation_id).maybeSingle(),
      admin.from("clients").select("id, company_name, document, contact_phone").eq("id", inst.client_id).maybeSingle(),
      admin.from("company_settings").select("company_name").limit(1).maybeSingle(),
    ]);

    if (!obl) return json({ error: "Obrigação não encontrada" }, 404);
    if (!client) return json({ error: "Cliente não encontrado" }, 404);

    const cnpj = onlyDigits(client.document);
    if (cnpj.length !== 14) return json({ error: "CNPJ do cliente inválido" }, 400);

    // Compute PA (AAAAMM) using competence_rule
    const refDate = new Date(inst.reference_month + "T00:00:00");
    const compDate = obl.competence_rule === "previous"
      ? new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1)
      : refDate;
    const paNum = compDate.getFullYear() * 100 + (compDate.getMonth() + 1);
    const mesAno = `${String(compDate.getMonth() + 1).padStart(2, "0")}/${compDate.getFullYear()}`;

    // PGDAS-D sem movimento payload
    const dadosPayload = {
      cnpjCompleto: cnpj,
      pa: paNum,
      indicadorTransmissao: true,
      indicadorComparacao: false,
      declaracao: {
        tipoDeclaracao: 1,
        receitaPaCompetenciaInterno: 0,
        receitaPaCompetenciaExterno: 0,
        receitaPaCaixaInterno: null,
        receitaPaCaixaExterno: null,
        valorFixoIcms: null,
        valorFixoIss: null,
        naoOptante: null,
        estabelecimentos: [{ cnpjCompleto: cnpj }],
      },
      valoresParaComparacao: [],
    };

    // Call integra-contador forwarding the caller's JWT (so client RLS validation works)
    const icRes = await fetch(`${supabaseUrl}/functions/v1/integra-contador`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
      },
      body: JSON.stringify({
        client_id: inst.client_id,
        idSistema: "PGDASD",
        idServico: "TRANSDECLARACAO11",
        versaoSistema: "1.0",
        tipo: "Declarar",
        dados: JSON.stringify(dadosPayload),
      }),
    });
    const icJson = await icRes.json().catch(() => ({} as any));
    const icStatus = icJson?.status ?? icRes.status;
    const icOk = icRes.ok && (icStatus === 200 || icStatus === 201);

    if (!icOk) {
      const msg = icJson?.mensagens?.[0]?.texto || icJson?.error || `Erro SERPRO ${icStatus}`;
      return json({ success: false, step: "serpro", error: msg, raw: icJson }, 200);
    }

    // Mark instance as done (sem movimento)
    await admin
      .from("obligation_instances")
      .update({ status: "done", completion_kind: "sem_movimento" })
      .eq("id", instance_id);

    // Send WhatsApp message via Evolution API
    let whatsappSent = false;
    let whatsappError: string | null = null;
    const phone = onlyDigits(client.contact_phone);
    const evoUrl = Deno.env.get("EVOLUTION_API_URL");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY");
    const evoInstance = Deno.env.get("EVOLUTION_INSTANCE_NAME");

    if (!phone) {
      whatsappError = "Cliente sem telefone cadastrado";
    } else if (!evoUrl || !evoKey || !evoInstance) {
      whatsappError = "Evolution API não configurada";
    } else {
      let evoPhone = phone;
      if (!evoPhone.startsWith("55")) evoPhone = "55" + evoPhone;
      const resolved = await resolveEvolutionNumber(evoUrl, evoKey, evoInstance, evoPhone);
      if (!resolved.exists || !resolved.number) {
        whatsappError = `Número não possui WhatsApp (${evoPhone})`;
      } else {
        const officeName = settings?.company_name || "sua contabilidade";
        const text =
          `Olá! 👋\n\n` +
          `Informamos que a empresa *${client.company_name}* não emitiu notas fiscais na competência *${mesAno}*.\n` +
          `Por esse motivo, o *Simples Nacional* foi declarado como *sem movimentação* junto à Receita Federal.\n\n` +
          `Caso identifique alguma divergência, entre em contato com nossa equipe o quanto antes.\n\n` +
          `Atenciosamente,\n${officeName}`;

        const r = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify({ number: resolved.number, text }),
        });
        if (r.ok) {
          whatsappSent = true;
        } else {
          const t = await r.text().catch(() => "");
          whatsappError = `Evolution API ${r.status}: ${t.slice(0, 200)}`;
        }
      }
    }

    return json({
      success: true,
      serpro: icJson,
      whatsapp_sent: whatsappSent,
      whatsapp_error: whatsappError,
    });
  } catch (e) {
    console.error("pgdasd-sem-movimento error:", e);
    return json({ error: String(e) }, 500);
  }
});