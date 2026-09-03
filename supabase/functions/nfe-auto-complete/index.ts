// Orquestra a captura de NF-e: distribuição incremental → manifestação (Ciência
// da Operação) em lote → nova distribuição para colher os procNFe liberados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MANIFEST_BATCH = 20;
const MAX_MANIFEST_ATTEMPTS = 3;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callFunction(name: string, body: Record<string, unknown>): Promise<any> {
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
  } catch { /* resposta sem json */ }
  return { data, ok: res.ok, status: res.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") || "";
    const isServiceCall = authHeader.replace(/^Bearer\s+/i, "") === SERVICE_KEY;
    if (!isServiceCall) {
      const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await anonClient.auth.getUser();
      if (userError || !user) return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const clientId: string | undefined = body?.client_id;
    if (!clientId) return jsonResponse({ error: "client_id é obrigatório" }, 400);

    const waitSeconds = Number.isFinite(body?.wait_seconds) ? Number(body.wait_seconds) : 10;
    const maxManifest = Number.isFinite(body?.max_manifest) ? Number(body.max_manifest) : 200;

    const errors: string[] = [];
    let capturadas = 0;
    let xmlCompletos = 0;
    let manifestadas = 0;
    let manifestErros = 0;
    let rateLimited = false;

    // a) Distribuição incremental
    try {
      const { data } = await callFunction("nfe-query", { client_id: clientId });
      if (data?.error) {
        errors.push(`nfe-query: ${data.error}`);
      } else {
        capturadas += Number(data?.invoices_saved || 0);
        xmlCompletos += Number(data?.xml_completos || 0);
      }
    } catch (e) {
      errors.push(`nfe-query: ${(e as Error).message}`);
    }

    // b) Notas elegíveis para Ciência da Operação
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let eligible: Array<{ id: string; manifest_attempts: number | null; manifest_status: string | null }> = [];
    try {
      const { data: rows, error } = await admin
        .from("nfe_invoices")
        .select("id, manifest_status, manifest_attempts, issue_date")
        .eq("client_id", clientId)
        .eq("direction", "entrada")
        .in("status", ["autorizada", "aguardando_ciencia"])
        .is("xml_url", null)
        .or(`issue_date.gte.${cutoff},issue_date.is.null`)
        .order("issue_date", { ascending: false })
        .limit(maxManifest);
      if (error) throw new Error(error.message);
      eligible = (rows || []).filter((r) =>
        r.manifest_status === null ||
        (r.manifest_status === "erro" && (r.manifest_attempts || 0) < MAX_MANIFEST_ATTEMPTS)
      ) as typeof eligible;
    } catch (e) {
      errors.push(`selecao: ${(e as Error).message}`);
    }

    // c) Manifestação em lotes de 20
    for (let i = 0; i < eligible.length; i += MANIFEST_BATCH) {
      const ids = eligible.slice(i, i + MANIFEST_BATCH).map((r) => r.id);
      try {
        const { data } = await callFunction("nfe-manifestacao", {
          client_id: clientId,
          nfe_invoice_ids: ids,
          tpEvento: "210210",
        });
        manifestadas += Number(data?.enviadas || 0);
        manifestErros += Number(data?.erros ?? (data?.error ? ids.length : 0));

        const payloadText = JSON.stringify(data ?? {});
        if (/\b656\b/.test(payloadText) || /consumo indevido/i.test(payloadText)) {
          rateLimited = true;
          errors.push("manifestacao: consumo indevido (656) — interrompido");
          break;
        }
        if (data?.error) errors.push(`manifestacao: ${data.error}`.slice(0, 300));
      } catch (e) {
        manifestErros += ids.length;
        errors.push(`manifestacao: ${(e as Error).message}`.slice(0, 300));
      }
    }

    // d) Nova distribuição para colher os procNFe liberados
    if (manifestadas > 0) {
      try {
        if (waitSeconds > 0) await sleep(waitSeconds * 1000);
        const { data } = await callFunction("nfe-query", { client_id: clientId });
        if (data?.error) {
          errors.push(`nfe-query (pós-manifestação): ${data.error}`);
        } else {
          capturadas += Number(data?.invoices_saved || 0);
          xmlCompletos += Number(data?.xml_completos || 0);
        }
      } catch (e) {
        errors.push(`nfe-query (pós-manifestação): ${(e as Error).message}`);
      }
    }

    // e) Pendentes
    let pendentes = 0;
    try {
      const { count } = await admin
        .from("nfe_invoices")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("direction", "entrada")
        .is("xml_url", null);
      pendentes = count || 0;
    } catch (e) {
      errors.push(`pendentes: ${(e as Error).message}`);
    }

    return jsonResponse({
      capturadas,
      client_id: clientId,
      errors,
      manifest_erros: manifestErros,
      manifestadas,
      pendentes,
      rate_limited: rateLimited,
      success: true,
      xml_completos: xmlCompletos,
    });
  } catch (error) {
    console.error("[nfe-auto-complete] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
