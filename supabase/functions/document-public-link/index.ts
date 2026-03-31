import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const instanceId = url.searchParams.get("instance");

  if (!instanceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instanceId)) {
    return new Response("<h1>Link inválido</h1>", {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch instance info
  const { data: instance } = await supabase
    .from("obligation_instances")
    .select("id, client_id, obligation_id, reference_month")
    .eq("id", instanceId)
    .single();

  if (!instance) {
    return new Response("<h1>Documentos não encontrados</h1>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Fetch client and obligation names
  const [clientRes, obligationRes] = await Promise.all([
    supabase.from("clients").select("company_name").eq("id", instance.client_id).single(),
    supabase.from("obligations").select("name").eq("id", instance.obligation_id).single(),
  ]);

  const clientName = clientRes.data?.company_name || "Cliente";
  const obligationName = obligationRes.data?.name || "Obrigação";
  const refDate = new Date(instance.reference_month + "T00:00:00");
  const competencia = refDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Fetch completions with files
  const { data: completions } = await supabase
    .from("obligation_activity_completions")
    .select("file_url, activity_id")
    .eq("instance_id", instanceId)
    .not("file_url", "is", null);

  if (!completions || completions.length === 0) {
    return new Response(renderHtml(clientName, obligationName, competencia, []),{
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Generate signed URLs (7 days)
  const files: { name: string; url: string }[] = [];
  for (const c of completions) {
    const path = c.file_url as string;
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

    if (signed?.signedUrl) {
      const fileName = path.split("/").pop() || "documento";
      files.push({ name: fileName, url: signed.signedUrl });
    }
  }

  return new Response(renderHtml(clientName, obligationName, competencia, files), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

function renderHtml(client: string, obligation: string, competencia: string, files: { name: string; url: string }[]): string {
  const fileList = files.length > 0
    ? files.map(f => `
      <a href="${f.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:#f8f9fa;border-radius:10px;text-decoration:none;color:#1a1a1a;border:1px solid #e0e0e0;transition:background 0.2s;">
        <svg width="24" height="24" fill="none" stroke="#4a90d9" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span style="font-size:15px;word-break:break-all;">${escapeHtml(decodeURIComponent(f.name.replace(/_/g, ' ')))}</span>
      </a>
    `).join("")
    : `<p style="color:#888;text-align:center;padding:20px;">Nenhum documento disponível.</p>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Documentos - ${escapeHtml(obligation)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;min-height:100vh;display:flex;justify-content:center;padding:20px}
    .container{max-width:480px;width:100%;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden}
    .header{background:linear-gradient(135deg,#075e54,#128c7e);color:#fff;padding:24px 20px}
    .header h1{font-size:18px;font-weight:600}
    .header p{font-size:13px;opacity:0.85;margin-top:4px}
    .files{padding:16px;display:flex;flex-direction:column;gap:10px}
    a:hover{background:#eef3fb !important}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(obligation)}</h1>
      <p>${escapeHtml(client)} · ${escapeHtml(competencia)}</p>
    </div>
    <div class="files">${fileList}</div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
