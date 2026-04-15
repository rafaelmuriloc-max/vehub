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

    // Step 1: GET the page to obtain ViewState, EventValidation and cookies
    console.log('[SAT-SC] Fetching initial page...');
    const getRes = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!getRes.ok) {
      return new Response(JSON.stringify({ error: `Erro ao acessar SAT/SC: ${getRes.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await getRes.text();

    const viewState = extractHiddenField(html, '__VIEWSTATE');
    const viewStateGen = extractHiddenField(html, '__VIEWSTATEGENERATOR');
    const eventValidation = extractHiddenField(html, '__EVENTVALIDATION');

    // Extract ALL cookies (multiple Set-Cookie headers)
    const cookieParts: string[] = [];
    // Deno's Headers.getSetCookie() returns all Set-Cookie values
    const setCookies = (getRes.headers as any).getSetCookie?.() || [];
    if (Array.isArray(setCookies)) {
      for (const sc of setCookies) {
        const name = sc.split(';')[0]?.trim();
        if (name) cookieParts.push(name);
      }
    } else {
      // fallback
      const raw = getRes.headers.get('set-cookie') || '';
      for (const part of raw.split(/,(?=\s*\w+=)/)) {
        const name = part.split(';')[0]?.trim();
        if (name) cookieParts.push(name);
      }
    }
    const cookieStr = cookieParts.join('; ');

    console.log('[SAT-SC] Tokens found - VS:', viewState.length, 'EVT:', eventValidation.length, 'Cookies:', cookieParts.length);

    // Format CNPJ with mask for the MaskedField
    const maskedCnpj = `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;

    // Step 2: POST with __EVENTTARGET to trigger search button
    const formData = new URLSearchParams();
    formData.append('__VIEWSTATE', viewState);
    if (viewStateGen) formData.append('__VIEWSTATEGENERATOR', viewStateGen);
    formData.append('__EVENTVALIDATION', eventValidation);
    formData.append('__EVENTTARGET', 'ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$btnBuscar');
    formData.append('__EVENTARGUMENT', '');
    formData.append('ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$idnContribuinte$IdentificationTypeField', '2');
    formData.append('ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$idnContribuinte$MaskedField', maskedCnpj);

    console.log('[SAT-SC] Submitting CNPJ:', maskedCnpj);
    const postRes = await fetch(pageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookieStr,
        'Referer': pageUrl,
        'Origin': 'https://sat.sef.sc.gov.br',
      },
      body: formData.toString(),
      redirect: 'follow',
    });

    const resultHtml = await postRes.text();
    console.log('[SAT-SC] Response status:', postRes.status, 'length:', resultHtml.length);

    // Log a meaningful snippet (skip scripts)
    const bodyMatch = resultHtml.match(/<div[^>]*class="[^"]*sat-ui-page-content[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*sat-ui-page-footer/i);
    if (bodyMatch) {
      console.log('[SAT-SC] Page content:', bodyMatch[1].substring(0, 3000));
    } else {
      // Log parts that might contain the result data
      const textOnly = resultHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
      console.log('[SAT-SC] Cleaned HTML (first 3000):', textOnly.substring(0, 3000));
    }

    const result = parseResult(resultHtml);
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

function extractHiddenField(html: string, name: string): string {
  // Match: <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="..." />
  const regex = new RegExp(`<input[^>]*name="${name}"[^>]*value="([^"]*)"`, 'i');
  const match = html.match(regex);
  if (match) return match[1];

  // Also try id-based
  const regex2 = new RegExp(`<input[^>]*id="${name}"[^>]*value="([^"]*)"`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1] : '';
}

function parseResult(html: string): {
  success: boolean;
  ie?: string;
  situacao?: string;
  razao_social?: string;
  error?: string;
  debug_snippet?: string;
} {
  // Strip scripts to avoid matching JS content
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Check for "not found" messages
  if (clean.includes('não foi encontrado') || clean.includes('Nenhum registro') || clean.includes('Contribuinte não encontrado')) {
    return { success: false, error: 'Contribuinte não encontrado no SAT/SC' };
  }

  let ie = '';
  let situacao = '';
  let razaoSocial = '';

  // The SAT/SC result page uses labeled fields in panels
  // Pattern 1: span-based labels like <span>Inscrição Estadual</span>...<span>VALUE</span>
  // Pattern 2: label/value in table cells
  // Pattern 3: ASP.NET control IDs

  // Try to find IE by known control ID patterns
  const ieIdPatterns = [
    /id="[^"]*InscricaoEstadual[^"]*"[^>]*>([^<]+)/i,
    /id="[^"]*inscricao[^"]*estadual[^"]*"[^>]*>([^<]+)/i,
    /id="[^"]*IE[^"]*"[^>]*>(\d[\d.]+)/i,
  ];

  for (const p of ieIdPatterns) {
    const m = clean.match(p);
    if (m && m[1]?.trim()) { ie = m[1].trim(); break; }
  }

  // Try label-based extraction
  if (!ie) {
    const ieLabelPatterns = [
      /Inscri[çc][aã]o\s*Estadual[^<]*<\/(?:label|span|td|div|th)>\s*(?:<[^>]*>)*\s*([^<]+)/i,
      /Inscri[çc][aã]o\s*Estadual[:\s]*<[^>]*>\s*(\d[\d.\/-]+)/i,
      /IE[:\s]+(\d{3}\.?\d{3}\.?\d{3})/i,
    ];
    for (const p of ieLabelPatterns) {
      const m = clean.match(p);
      if (m && m[1]?.trim()) { ie = m[1].trim(); break; }
    }
  }

  // Situação Cadastral
  const situacaoIdPatterns = [
    /id="[^"]*[Ss]ituacao[^"]*[Cc]adastral[^"]*"[^>]*>([^<]+)/i,
    /id="[^"]*situacaoCadastral[^"]*"[^>]*>([^<]+)/i,
  ];
  for (const p of situacaoIdPatterns) {
    const m = clean.match(p);
    if (m && m[1]?.trim()) { situacao = m[1].trim(); break; }
  }

  if (!situacao) {
    const situacaoLabelPatterns = [
      /Situa[çc][aã]o\s*Cadastral[^<]*<\/(?:label|span|td|div|th)>\s*(?:<[^>]*>)*\s*([^<]+)/i,
      /Situa[çc][aã]o\s*Cadastral[:\s]*<[^>]*>\s*([^<]+)/i,
      /Situa..o[:\s]*(Ativ[oa]|Baixad[oa]|Suspens[oa]|Cancel[ao]d[ao]|Inapt[ao]|Nul[ao])/i,
    ];
    for (const p of situacaoLabelPatterns) {
      const m = clean.match(p);
      if (m && m[1]?.trim()) { situacao = m[1].trim(); break; }
    }
  }

  // Razão Social
  const razaoPatterns = [
    /id="[^"]*[Rr]azao[^"]*[Ss]ocial[^"]*"[^>]*>([^<]+)/i,
    /Raz[aã]o\s*Social[^<]*<\/(?:label|span|td|div|th)>\s*(?:<[^>]*>)*\s*([^<]+)/i,
    /Nome[\/\s]*Raz[aã]o[^<]*<\/(?:label|span|td|div|th)>\s*(?:<[^>]*>)*\s*([^<]+)/i,
  ];
  for (const p of razaoPatterns) {
    const m = clean.match(p);
    if (m) {
      const val = (m[2] || m[1] || '').trim();
      if (val) { razaoSocial = val; break; }
    }
  }

  if (!ie && !situacao) {
    // Extract a debug snippet - any panel content after the search form
    const panelMatch = clean.match(/panel-body[\s\S]{0,5000}/i);
    return {
      success: false,
      error: 'Não foi possível extrair dados. Verifique os logs.',
      debug_snippet: panelMatch ? panelMatch[0].substring(0, 1000) : clean.substring(0, 1000),
    };
  }

  return {
    success: true,
    ie: ie || undefined,
    situacao: situacao || undefined,
    razao_social: razaoSocial || undefined,
  };
}
