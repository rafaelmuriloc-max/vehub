import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Get all retention obligations
    const { data: retentionObligations, error: obErr } = await admin
      .from("obligations")
      .select("id, retention_tax_type, due_day, department_id, recurrence")
      .eq("is_retention", true);

    if (obErr) throw obErr;
    if (!retentionObligations || retentionObligations.length === 0) {
      return jsonResponse({ message: "No retention obligations found", generated: 0 });
    }

    // 2. Determine previous month
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-based
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    // Current month for obligation instance reference
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    const refDate = `${curYear}-${String(curMonth).padStart(2, "0")}-01`;

    // 3. Get all active clients with their CNPJ
    const { data: allClients } = await admin
      .from("clients")
      .select("id, document")
      .eq("status", "active");

    if (!allClients || allClients.length === 0) {
      return jsonResponse({ message: "No active clients", generated: 0 });
    }

    // Build CNPJ -> client_id map (strip non-digits)
    const cnpjToClient = new Map<string, string>();
    for (const c of allClients) {
      if (c.document) {
        cnpjToClient.set(c.document.replace(/\D/g, ""), c.id);
      }
    }

    // 4. Get invoices from previous month (NFS-e tomadas)
    // Tomada = issuer_cnpj != client's CNPJ (the client is the taker)
    const { data: invoices } = await admin
      .from("invoices")
      .select("client_id, issuer_cnpj, raw_data")
      .gte("issue_date", `${prevMonthStr}-01`)
      .lt("issue_date", `${curYear}-${String(curMonth).padStart(2, "0")}-01`);

    if (!invoices || invoices.length === 0) {
      return jsonResponse({ message: "No invoices in previous month", generated: 0 });
    }

    // 5. For each client, check invoices for retentions
    // Two flows: "tomadas" (client is taker) and "prestadas" (client is issuer)
    const clientRetentions = new Map<string, Set<string>>(); // client_id -> Set of retention types (tomadas)
    const clientPrestadas = new Set<string>(); // client_ids that issued invoices in the period

    for (const inv of invoices) {
      const client = allClients.find((c) => c.id === inv.client_id);
      if (!client?.document) continue;

      const clientCnpj = client.document.replace(/\D/g, "");
      const issuerCnpj = (inv.issuer_cnpj || "").replace(/\D/g, "");

      const isEmitted = issuerCnpj === clientCnpj;

      if (isEmitted) {
        // Prestadas: client is the issuer — used for REINF/INSS
        const xml = inv.raw_data?.xml as string | undefined;
        if (xml) {
          const hasRetINSS = extractXmlValue(xml, "vRetINSS") > 0
            || extractXmlValue(xml, "vRetCP") > 0
            || /RETEN[CÇ][AÃ]O\s+DE\s+INSS/i.test(xml)
            || /CONTRIBUI[CÇ][AÃ]O\s+PREVIDENCI[AÁ]RIA\s+RETIDA/i.test(xml);
          if (hasRetINSS) {
            clientPrestadas.add(inv.client_id);
          }
        }
      } else {
        // Tomadas: client is the taker — used for other retention types
        const xml = inv.raw_data?.xml as string | undefined;
        if (!xml) continue;

        const retTypes = detectRetentions(xml);
        if (retTypes.length > 0) {
          if (!clientRetentions.has(inv.client_id)) {
            clientRetentions.set(inv.client_id, new Set());
          }
          const set = clientRetentions.get(inv.client_id)!;
          for (const t of retTypes) set.add(t);
        }
      }
    }

    // 6. Generate obligation instances
    let totalGenerated = 0;

    for (const ob of retentionObligations) {
      if (!ob.retention_tax_type) continue;

      // For INSS/REINF: use prestadas (client is issuer)
      // For all other types: use tomadas (client is taker)
      let clientsWithRetention: string[];

      if (ob.retention_tax_type === "inss") {
        clientsWithRetention = Array.from(clientPrestadas);
      } else {
        clientsWithRetention = [];
        for (const [clientId, types] of clientRetentions) {
          if (types.has(ob.retention_tax_type)) {
            clientsWithRetention.push(clientId);
          }
        }
      }

      if (clientsWithRetention.length === 0) continue;

      // Check existing instances
      const { data: existing } = await admin
        .from("obligation_instances")
        .select("client_id")
        .eq("obligation_id", ob.id)
        .eq("reference_month", refDate);

      const existingSet = new Set((existing || []).map((e: any) => e.client_id));

      // Calculate due date
      let dueDate: string | null = null;
      if (ob.due_day) {
        const dd = Math.min(ob.due_day, 28);
        dueDate = `${curYear}-${String(curMonth).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        // Simple business day adjustment (skip weekends)
        const d = new Date(dueDate + "T12:00:00");
        while (d.getDay() === 0 || d.getDay() === 6) {
          d.setDate(d.getDate() - 1);
        }
        dueDate = d.toISOString().split("T")[0];
      }

      const rows = clientsWithRetention
        .filter((cid) => !existingSet.has(cid))
        .map((cid) => ({
          obligation_id: ob.id,
          client_id: cid,
          reference_month: refDate,
          due_date: dueDate,
          status: "pending",
        }));

      if (rows.length > 0) {
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error } = await admin.from("obligation_instances").insert(batch);
          if (error) console.error("Insert error:", error.message);
        }
        totalGenerated += rows.length;
      }
    }

    return jsonResponse({ message: "OK", generated: totalGenerated, prevMonth: prevMonthStr });
  } catch (err: any) {
    console.error("Error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});

function extractXmlValue(xml: string, tag: string): number {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? parseFloat(match[1]) || 0 : 0;
}

function detectRetentions(xml: string): string[] {
  const types: string[] = [];

  // ISS: tpRetISSQN === 2 and vTotalRet > 0
  const tpRet = extractXmlValue(xml, "tpRetISSQN");
  const vTotalRet = extractXmlValue(xml, "vTotalRet");
  if (tpRet === 2 && vTotalRet > 0) types.push("iss");

  // INSS
  if (extractXmlValue(xml, "vRetINSS") > 0) types.push("inss");

  // IRRF
  if (extractXmlValue(xml, "vRetIRRF") > 0) types.push("irrf");

  // PIS
  if (extractXmlValue(xml, "vRetPIS") > 0) types.push("pis");

  // COFINS
  if (extractXmlValue(xml, "vRetCOFINS") > 0) types.push("cofins");

  // CSLL
  if (extractXmlValue(xml, "vRetCSLL") > 0) types.push("csll");

  // CP
  if (extractXmlValue(xml, "vRetCP") > 0) types.push("cp");

  return types;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
