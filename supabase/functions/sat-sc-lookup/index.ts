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

    // Extract cookies
    const cookieParts: string[] = [];
    const setCookies = (getRes.headers as any).getSetCookie?.() || [];
    if (Array.isArray(setCookies) && setCookies.length > 0) {
      for (const sc of setCookies) {
        const name = sc.split(';')[0]?.trim();
        if (name) cookieParts.push(name);
      }
    }
    const cookieStr = cookieParts.join('; ');

    console.log('[SAT-SC] VS:', viewState.length, 'EVT:', eventValidation.length, 'Cookies:', cookieParts.length);

    // Step 2: Async POST (ASP.NET UpdatePanel format)
    const btnUniqueId = 'ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$btnBuscar';
    const updatePanelId = 'ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$uppBusca';

    const formData = new URLSearchParams();
    // ScriptManager field tells ASP.NET which UpdatePanel triggered the postback
    formData.append('ctl00$ctl00$ctl00$ScriptManager1', `${updatePanelId}|${btnUniqueId}`);
    formData.append('__VIEWSTATE', viewState);
    if (viewStateGen) formData.append('__VIEWSTATEGENERATOR', viewStateGen);
    formData.append('__EVENTVALIDATION', eventValidation);
    formData.append('__EVENTTARGET', btnUniqueId);
    formData.append('__EVENTARGUMENT', '');
    formData.append('__ASYNCPOST', 'true');
    formData.append('ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$idnContribuinte$IdentificationTypeField', '2');
    formData.append('ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$idnContribuinte$MaskedField', maskedCnpj);

    console.log('[SAT-SC] Submitting async postback for:', maskedCnpj);
    const postRes = await fetch(pageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookieStr,
        'X-Requested-With': 'XMLHttpRequest',
        'X-MicrosoftAjax': 'Delta=true',
        'Referer': pageUrl,
        'Origin': 'https://sat.sef.sc.gov.br',
      },
      body: formData.toString(),
      redirect: 'follow',
    });

    const responseText = await postRes.text();
    console.log('[SAT-SC] Response status:', postRes.status, 'length:', responseText.length);
    console.log('[SAT-SC] Response first 2000:', responseText.substring(0, 2000));

    // Check if it's a redirect (ASP.NET pageRedirect in async response)
    if (responseText.includes('pageRedirect')) {
      // Extract the redirect URL and follow it
      const redirectMatch = responseText.match(/pageRedirect\|\|([^|]+)\|/);
      if (redirectMatch) {
        const redirectUrl = new URL(redirectMatch[1], pageUrl).toString();
        console.log('[SAT-SC] Following redirect to:', redirectUrl);
        
        // Get the redirected page cookies
        const postCookies = [...cookieParts];
        const postSetCookies = (postRes.headers as any).getSetCookie?.() || [];
        if (Array.isArray(postSetCookies)) {
          for (const sc of postSetCookies) {
            const name = sc.split(';')[0]?.trim();
            if (name) postCookies.push(name);
          }
        }

        const redirectRes = await fetch(redirectUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': postCookies.join('; '),
            'Referer': pageUrl,
          },
          redirect: 'follow',
        });
        const redirectHtml = await redirectRes.text();
        console.log('[SAT-SC] Redirect page length:', redirectHtml.length);
        const result = parseHtmlResult(redirectHtml);
        console.log('[SAT-SC] Result:', JSON.stringify(result));
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Parse the async response (pipe-delimited UpdatePanel format)
    const result = parseAsyncResponse(responseText);
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
  const regex = new RegExp(`<input[^>]*name="${name}"[^>]*value="([^"]*)"`, 'i');
  const match = html.match(regex);
  if (match) return match[1];
  const regex2 = new RegExp(`<input[^>]*id="${name}"[^>]*value="([^"]*)"`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1] : '';
}

/**
 * Parse ASP.NET UpdatePanel async response format:
 * Each block is: length|type|id|content|
 * Types: updatePanel, hiddenField, scriptBlock, etc.
 */
function parseAsyncResponse(text: string): any {
  // Extract updatePanel blocks which contain the HTML
  const panels: Record<string, string> = {};
  let pos = 0;

  while (pos < text.length) {
    // Read length
    const pipeIdx = text.indexOf('|', pos);
    if (pipeIdx === -1) break;
    const len = parseInt(text.substring(pos, pipeIdx), 10);
    if (isNaN(len)) break;

    pos = pipeIdx + 1;
    // Read type
    const typeEnd = text.indexOf('|', pos);
    if (typeEnd === -1) break;
    const type = text.substring(pos, typeEnd);

    pos = typeEnd + 1;
    // Read id
    const idEnd = text.indexOf('|', pos);
    if (idEnd === -1) break;
    const id = text.substring(pos, idEnd);

    pos = idEnd + 1;
    // Read content (length bytes)
    const content = text.substring(pos, pos + len);
    pos = pos + len + 1; // +1 for trailing pipe

    if (type === 'updatePanel') {
      panels[id] = content;
    }
  }

  console.log('[SAT-SC] Parsed panels:', Object.keys(panels));

  // Combine all panel content and parse
  const allContent = Object.values(panels).join('\n');
  if (allContent) {
    return parseHtmlResult(allContent);
  }

  // If no panels found, try parsing the raw text as HTML
  return parseHtmlResult(text);
}

function parseHtmlResult(html: string): any {
  // Strip scripts
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Check for errors
  if (clean.includes('não foi possível completar') || clean.includes('erro inesperado')) {
    return { success: false, error: 'Erro no servidor SAT/SC. Tente novamente.' };
  }

  if (clean.includes('não foi encontrado') || clean.includes('Nenhum registro') || clean.includes('não encontrado')) {
    return { success: false, error: 'Contribuinte não encontrado no SAT/SC' };
  }

  let ie = '';
  let situacao = '';
  let razaoSocial = '';

  // Try ASP.NET control IDs
  const patterns: Array<{ field: 'ie' | 'situacao' | 'razaoSocial'; regex: RegExp }> = [
    // IE patterns
    { field: 'ie', regex: /id="[^"]*[Ii]nscricao[^"]*[Ee]stadual[^"]*"[^>]*>([^<]+)/i },
    { field: 'ie', regex: /id="[^"]*IE[^"]*"[^>]*>(\d[\d.]+)/i },
    { field: 'ie', regex: /Inscri[çc][aã]o\s*Estadual[\s:]*<\/(?:label|span|td|div|th|b|strong)>\s*(?:<[^>]*>\s*)*([^<]+)/i },
    { field: 'ie', regex: /Inscri..o Estadual[^<]*?(\d{3}\.?\d{3}\.?\d{3})/i },
    // Situação patterns
    { field: 'situacao', regex: /id="[^"]*[Ss]ituacao[^"]*"[^>]*>([^<]+)/i },
    { field: 'situacao', regex: /Situa[çc][aã]o\s*Cadastral[\s:]*<\/(?:label|span|td|div|th|b|strong)>\s*(?:<[^>]*>\s*)*([^<]+)/i },
    { field: 'situacao', regex: /Situa..o\s*Cadastral[^<]*?<[^>]*>\s*(Ativ[oa]|Baixad[oa]|Suspens[oa]|Inapt[oa]|Cancel[ao]d[ao])/i },
    // Razão Social patterns
    { field: 'razaoSocial', regex: /id="[^"]*[Rr]azao[^"]*[Ss]ocial[^"]*"[^>]*>([^<]+)/i },
    { field: 'razaoSocial', regex: /Raz[aã]o\s*Social[\s:]*<\/(?:label|span|td|div|th|b|strong)>\s*(?:<[^>]*>\s*)*([^<]+)/i },
    { field: 'razaoSocial', regex: /Nome[\/\s]*Raz[aã]o[^<]*<\/(?:label|span|td|div|th)>\s*(?:<[^>]*>\s*)*([^<]+)/i },
  ];

  for (const { field, regex } of patterns) {
    const m = clean.match(regex);
    if (m) {
      const val = m[1]?.trim();
      if (val && val.length > 1) {
        if (field === 'ie' && !ie) ie = val;
        if (field === 'situacao' && !situacao) situacao = val;
        if (field === 'razaoSocial' && !razaoSocial) razaoSocial = val;
      }
    }
  }

  if (!ie && !situacao) {
    const snippet = clean.replace(/\s+/g, ' ').substring(0, 1500);
    return {
      success: false,
      error: 'Não foi possível extrair dados do SAT/SC.',
      debug_snippet: snippet,
    };
  }

  return {
    success: true,
    ie: ie || undefined,
    situacao: situacao || undefined,
    razao_social: razaoSocial || undefined,
  };
}
