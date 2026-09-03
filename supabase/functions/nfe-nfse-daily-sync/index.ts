import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

// Clientes processados por invocação — a function se auto-reinvoca para a próxima fatia.
const MAX_CLIENTS_PER_RUN = 15;
const DELAY_BETWEEN_CLIENTS_MS = 800;
const LEASE_MS = 15 * 60 * 1000;

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
  try {
    data = await res.json();
  } catch {
    /* resposta sem json */
  }
  if (!res.ok || data?.error) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data;
}

/** Dispara a próxima fatia sem aguardar o resultado. */
function triggerNextSlice(body: Record<string, unknown>) {
  const promise = fetch(`${SUPABASE_URL}/functions/v1/nfe-nfse-daily-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch((e) => console.error("[daily-sync] Falha ao encadear fatia:", (e as Error).message));

  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(promise);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ---- Autorização: service role, segredo do cron ou usuário autenticado ----
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  let authorized = bearer === SERVICE_KEY ||
    (!!CRON_SECRET && cronHeader === CRON_SECRET);

  if (!authorized && bearer) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) authorized = true;
  }

  if (!authorized) return jsonResponse({ error: "Não autorizado" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* cron chama sem body */
  }

  const referenceDate: string =
    typeof body?.reference_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.reference_date)
      ? body.reference_date
      : previousDayBrasilia();
  const referenceMonth = `${referenceDate.slice(0, 7)}-01`;
  const singleClientId: string | undefined =
    typeof body?.client_id === "string" ? body.client_id : undefined;
  const continuationRunId: string | undefined =
    typeof body?.run_id === "string" ? body.run_id : undefined;

  // ---- Localiza/cria a run do dia ----
  let run: any = null;

  if (continuationRunId) {
    const { data } = await supabase
      .from("nfe_sync_runs")
      .select("*")
      .eq("id", continuationRunId)
      .maybeSingle();
    run = data;
    if (!run || run.status !== "running") {
      return jsonResponse({ skipped: true, reason: "run_not_running", run_id: continuationRunId });
    }
  } else {
    const { data: existing } = await supabase
      .from("nfe_sync_runs")
      .select("*")
      .eq("status", "running")
      .eq("reference_date", referenceDate)
      .order("started_at", { ascending: false })
      .limit(1);

    const active = existing?.[0];
    if (active) {
      if (new Date(active.lease_expires_at).getTime() > Date.now()) {
        // Outra execução da mesma run está em andamento.
        return jsonResponse({ skipped: true, reason: "already_running", run_id: active.id });
      }
      run = active; // lease expirado: retomamos esta run
    }
  }

  if (!run) {
    const { data: created, error: runError } = await supabase
      .from("nfe_sync_runs")
      .insert({
        reference_date: referenceDate,
        status: "running",
        clients_total: 0,
        lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString(),
      })
      .select("*")
      .single();
    if (runError || !created) {
      return jsonResponse({ error: runError?.message ?? "Falha ao criar execução" }, 500);
    }
    run = created;
  }

  // Renova o lease imediatamente para bloquear execuções concorrentes.
  await supabase
    .from("nfe_sync_runs")
    .update({ lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString() })
    .eq("id", run.id);

  // ---- Clientes elegíveis desta fatia ----
  const today = new Date().toISOString().slice(0, 10);
  const baseFilter = () =>
    supabase
      .from("clients")
      .select("id, company_name", { count: "exact" })
      .eq("status", "active")
      .not("document", "is", null)
      .not("digital_certificate_url", "is", null)
      .gte("digital_certificate_expiry", today);

  let sliceQuery = baseFilter().order("company_name").limit(MAX_CLIENTS_PER_RUN);
  if (singleClientId) {
    sliceQuery = sliceQuery.eq("id", singleClientId);
  } else if (run.cursor_client_id) {
    sliceQuery = sliceQuery.gt("company_name", run.cursor_client_id);
  }

  const { data: clients, error: clientsError } = await sliceQuery;
  if (clientsError) return jsonResponse({ error: clientsError.message }, 500);

  // Total de clientes da run (apenas na primeira fatia)
  if (!run.clients_total) {
    const totalQuery = baseFilter();
    if (singleClientId) totalQuery.eq("id", singleClientId);
    const { count } = await totalQuery;
    if (count != null) {
      run.clients_total = count;
      await supabase.from("nfe_sync_runs").update({ clients_total: count }).eq("id", run.id);
    }
  }

  const slice = clients ?? [];

  const details: any[] = Array.isArray(run.details) ? run.details : [];
  let processed = run.clients_processed ?? 0;
  let nfeOk = run.nfe_success ?? 0;
  let nfeErr = run.nfe_errors ?? 0;
  let nfseOk = run.nfse_success ?? 0;
  let nfseErr = run.nfse_errors ?? 0;
  let nfeManifestadas = run.nfe_manifestadas ?? 0;
  let nfeXmlCompletos = run.nfe_xml_completos ?? 0;
  let cursor: string | null = run.cursor_client_id ?? null;

  for (const c of slice) {
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
    cursor = c.company_name;
    details.push(entry);

    await sleep(DELAY_BETWEEN_CLIENTS_MS);
  }

  const hasMore = !singleClientId && slice.length === MAX_CLIENTS_PER_RUN;

  await supabase
    .from("nfe_sync_runs")
    .update({
      status: hasMore ? "running" : "done",
      finished_at: hasMore ? null : new Date().toISOString(),
      cursor_client_id: cursor,
      clients_processed: processed,
      nfe_success: nfeOk,
      nfe_errors: nfeErr,
      nfse_success: nfseOk,
      nfse_errors: nfseErr,
      nfe_manifestadas: nfeManifestadas,
      nfe_xml_completos: nfeXmlCompletos,
      details,
      lease_expires_at: new Date(Date.now() + (hasMore ? LEASE_MS : 0)).toISOString(),
    })
    .eq("id", run.id);

  if (hasMore) {
    triggerNextSlice({ run_id: run.id, reference_date: referenceDate });
  }

  return jsonResponse({
    success: true,
    run_id: run.id,
    reference_date: referenceDate,
    status: hasMore ? "running" : "done",
    slice: slice.length,
    clients: processed,
    nfe: { ok: nfeOk, errors: nfeErr, manifestadas: nfeManifestadas, xml_completos: nfeXmlCompletos },
    nfse: { ok: nfseOk, errors: nfseErr },
  });
});
