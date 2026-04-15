const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    if (!cnpj) {
      return new Response(JSON.stringify({ error: 'CNPJ é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      return new Response(JSON.stringify({ error: 'CNPJ inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pageUrl = 'https://sat.sef.sc.gov.br/tax.NET/Sat.Cadastro.Web/ComprovanteIE/Consulta.aspx';
    const maskedCnpj = `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;

    // Step 1: GET the page
    console.log('[SAT-SC] GET page...');
    const getRes = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!getRes.ok) {
      return new Response(JSON.stringify({ error: `SAT/SC indisponível: ${getRes.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await getRes.text();
    const viewState = extractField(html, '__VIEWSTATE');
    const viewStateGen = extractField(html, '__VIEWSTATEGENERATOR');
    const eventValidation = extractField(html, '__EVENTVALIDATION');

    const cookieParts: string[] = [];
    const setCookies = (getRes.headers as any).getSetCookie?.() || [];
    if (Array.isArray(setCookies)) {
      for (const sc of setCookies) {
        const name = sc.split(';')[0]?.trim();
        if (name) cookieParts.push(name);
      }
    }

    console.log('[SAT-SC] VS:', viewState.length, 'EV:', eventValidation.length);

    // Step 2: Standard POST (NOT async - full page response)
    const body = new URLSearchParams();
    body.append('__EVENTTARGET', 'ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$btnBuscar');
    body.append('__EVENTARGUMENT', '');
    body.append('__VIEWSTATE', viewState);
    if (viewStateGen) body.append('__VIEWSTATEGENERATOR', viewStateGen);
    body.append('__EVENTVALIDATION', eventValidation);
    body.append('ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$idnContribuinte$IdentificationTypeField', '2');
    body.append('ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$idnContribuinte$MaskedField', maskedCnpj);

    console.log('[SAT-SC] POST CNPJ:', maskedCnpj);
    const postRes = await fetch(pageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': cookieParts.join('; '),
        'Referer': pageUrl,
        'Origin': 'https://sat.sef.sc.gov.br',
      },
      body: body.toString(),
      redirect: 'follow',
    });

    // Follow manual redirects if needed
    let resultHtml = await postRes.text();
    console.log('[SAT-SC] POST status:', postRes.status, 'len:', resultHtml.length);

    // If redirected page, follow
    if (postRes.status >= 300 && postRes.status < 400) {
      const loc = postRes.headers.get('location');
      if (loc) {
        const redirectUrl = new URL(loc, pageUrl).toString();
        console.log('[SAT-SC] Redirect to:', redirectUrl);
        const r = await fetch(redirectUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Cookie': cookieParts.join('; '),
          },
        });
        resultHtml = await r.text();
      }
    }

    // Strip scripts/styles for clean parsing
    const clean = resultHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');

    // Log meaningful content for debugging
    const contentArea = clean.match(/sat-ui-page-content[\s\S]{0,8000}/i);
    console.log('[SAT-SC] Content area:', (contentArea?.[0] || clean).substring(0, 4000));

    const result = parseResult(clean);
    console.log('[SAT-SC] Result:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[SAT-SC] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractField(html: string, name: string): string {
  const m = html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`, 'i'));
  if (m) return m[1];
  const m2 = html.match(new RegExp(`id="${name}"[^>]*value="([^"]*)"`, 'i'));
  return m2 ? m2[1] : '';
}

function parseResult(clean: string): any {
  if (clean.includes('não foi possível completar') || clean.includes('erro inesperado')) {
    return { success: false, error: 'Erro no servidor SAT/SC. Tente novamente.' };
  }
  if (clean.includes('não foi encontrad') || clean.includes('Nenhum registro encontrad')) {
    return { success: false, error: 'Contribuinte não encontrado no SAT/SC' };
  }

  let ie = '', situacao = '', razaoSocial = '';

  // Try multiple regex patterns for IE, Situação, Razão Social
  const allPatterns: { field: string; re: RegExp }[] = [
    // IE
    { field: 'ie', re: /Inscri[çc][aã]o\s*Estadual[^<]*<\/[^>]+>\s*(?:<[^>]*>\s*)*([^<]+)/i },
    { field: 'ie', re: /IE[:\s]*(\d{3}\.?\d{3}\.?\d{3})/i },
    { field: 'ie', re: /id="[^"]*[Ii]nscricao[Ee]stadual[^"]*"[^>]*>([^<]+)/i },
    // Situação - only match in structured data context, not random words
    { field: 'situacao', re: /Situa[çc][aã]o\s*Cadastral[^<]*<\/[^>]+>\s*(?:<[^>]*>\s*)*([^<]+)/i },
    { field: 'situacao', re: /id="[^"]*[Ss]ituacao[Cc]adastral[^"]*"[^>]*>([^<]+)/i },
    // Razão Social
    { field: 'razao', re: /Raz[aã]o\s*Social[^<]*<\/[^>]+>\s*(?:<[^>]*>\s*)*([^<]+)/i },
    { field: 'razao', re: /Nome[^<]*Raz[aã]o[^<]*<\/[^>]+>\s*(?:<[^>]*>\s*)*([^<]+)/i },
    { field: 'razao', re: /id="[^"]*[Rr]azao[Ss]ocial[^"]*"[^>]*>([^<]+)/i },
  ];

  for (const { field, re } of allPatterns) {
    const m = clean.match(re);
    if (m) {
      const val = m[1]?.trim();
      if (val && val.length > 1) {
        if (field === 'ie' && !ie) ie = val;
        if (field === 'situacao' && !situacao) situacao = val;
        if (field === 'razao' && !razaoSocial) razaoSocial = val;
      }
    }
  }

  if (!ie && !situacao) {
    return {
      success: false,
      error: 'Não foi possível extrair dados do SAT/SC. O CNPJ pode não estar registrado em SC.',
      debug_snippet: clean.replace(/\s+/g, ' ').substring(0, 1000),
    };
  }

  return {
    success: true,
    ie: ie || undefined,
    situacao: situacao || undefined,
    razao_social: razaoSocial || undefined,
  };
}
