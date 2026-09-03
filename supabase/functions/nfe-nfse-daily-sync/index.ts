import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Limite de clientes por execução (retomada na próxima chamada)
const MAX_CLIENTS_PER_RUN = 250;
const DELAY_BETWEEN_CLIENTS_MS = 800;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Data (YYYY-MM-DD) do dia anterior no fuso de Brasília */
function previousDayBrasilia(): string {
  const nowBr = new Date(Date.now() - 3 * 60 * 60 * 1000);
  nowBr.setUTCDate(nowBr.getUTCDate() - 1);
  return nowBr.toISOString().slice(0, 10);
}

async function callFunction(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* resposta sem json */ }
  if (!res.ok || data?.error) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try { body = await req.json(); } catch { /* cron chama sem body */ }

  const referenceDate: string = typeof body?.reference_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.reference_date)
    ? body.reference_date
    : previousDayBrasilia();
  const referenceMonth = `${referenceDate.slice(0, 7)}-01`;

  // ---- Trava de execução única (lease) ----
  const { data: active } = await supabase
    .from("nfe_sync_runs")
    .select("id, started_at, lease_expires_at")
    .eq("status", "running")
    .gt("lease_expires_at", new Date().toISOString())
    .limit(1);

  if (active && active.length > 0) {
    return jsonResponse({ skipped: true, reason: "already_running", run_id: active[0].id });
  }

  // ---- Clientes elegíveis: ativos, com CNPJ e certificado válido ----
  const today = new Date().toISOString().slice(0, 10);
  const clientsQuery = supabase
    .from("clients")
    .select("id, company_name, sci_code, document, digital_certificate_url, digital_certificate_expiry")
    .eq("status", "active")
    .not("document", "is", null)
    .not("digital_certificate_url", "is", null)
    .gte("digital_certificate_expiry", today)
    .order("company_name");

  if (typeof body?.client_id === "string") clientsQuery.eq("id", body.client_id);

  const { data: clients, error: clientsError } = await clientsQuery;

  if (clientsError) return jsonResponse({ error: clientsError.message }, 500);

  const eligible = (clients ?? []).slice(0, MAX_CLIENTS_PER_RUN);

  const { data: run, error: runError } = await supabase
    .from("nfe_sync_runs")
    .insert({
      reference_date: referenceDate,
      status: "running",
      clients_total: eligible.length,
      lease_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (runError || !run) return jsonResponse({ error: runError?.message ?? "Falha ao criar execução" }, 500);

  const details: any[] = [];
  let processed = 0;
  let nfeOk = 0, nfeErr = 0, nfseOk = 0, nfseErr = 0;
  let nfeManifestadas = 0, nfeXmlCompletos = 0;

  for (const c of eligible) {
    const entry: any = { client_id: c.id, company: c.company_name };

    try {
      const auto = await callFunction("nfe-auto-complete", {
        client_id: c.id,
        wait_seconds: 5,
      });
      nfeOk++;
      entry.nfe = "ok";
      entry.capturadas = auto?.capturadas ?? 0;
      entry.manifestadas = auto?.manifestadas ?? 0;
      entry.xml_completos = auto?.xml_completos ?? 0;
      entry.pendentes = auto?.pendentes ?? 0;
      nfeManifestadas += Number(auto?.manifestadas || 0);
      nfeXmlCompletos += Number(auto?.xml_completos || 0);
    } catch (e) {
      nfeErr++;
      entry.nfe = `erro: ${(e as Error).message}`.slice(0, 300);
    }

    try {
      await callFunction("nfse-query", {
        client_id: c.id,
        reference_month: referenceMonth,
      });
      nfseOk++;
      entry.nfse = "ok";
    } catch (e) {
      nfseErr++;
      entry.nfse = `erro: ${(e as Error).message}`.slice(0, 300);
    }

    processed++;
    details.push(entry);

    // renova lease e progresso a cada 10 clientes
    if (processed % 10 === 0) {
      await supabase.from("nfe_sync_runs").update({
        clients_processed: processed,
        nfe_success: nfeOk, nfe_errors: nfeErr,
        nfse_success: nfseOk, nfse_errors: nfseErr,
        nfe_manifestadas: nfeManifestadas, nfe_xml_completos: nfeXmlCompletos,
        lease_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }).eq("id", run.id);
    }

    await sleep(DELAY_BETWEEN_CLIENTS_MS);
  }

  await supabase.from("nfe_sync_runs").update({
    status: "done",
    finished_at: new Date().toISOString(),
    clients_processed: processed,
    nfe_success: nfeOk, nfe_errors: nfeErr,
    nfse_success: nfseOk, nfse_errors: nfseErr,
    nfe_manifestadas: nfeManifestadas, nfe_xml_completos: nfeXmlCompletos,
    details,
  }).eq("id", run.id);

  return jsonResponse({
    success: true,
    run_id: run.id,
    reference_date: referenceDate,
    clients: processed,
    nfe: { ok: nfeOk, errors: nfeErr, manifestadas: nfeManifestadas, xml_completos: nfeXmlCompletos },
    nfse: { ok: nfseOk, errors: nfseErr },
  });
});
