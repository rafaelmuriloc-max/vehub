import { corsHeaders } from '@supabase/supabase-js/cors';

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
    });

    if (!getRes.ok) {
      console.error('[SAT-SC] GET failed:', getRes.status);
      return new Response(JSON.stringify({ error: `Erro ao acessar SAT/SC: ${getRes.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await getRes.text();

    // Extract ASP.NET tokens
    const viewState = extractField(html, '__VIEWSTATE');
    const viewStateGen = extractField(html, '__VIEWSTATEGENERATOR');
    const eventValidation = extractField(html, '__EVENTVALIDATION');
    const previousPage = extractField(html, '__PREVIOUSPAGE');

    // Extract cookies
    const cookies = (getRes.headers.get('set-cookie') || '')
      .split(',')
      .map(c => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    console.log('[SAT-SC] ViewState found:', !!viewState, 'EventValidation found:', !!eventValidation, 'Cookies:', cookies.substring(0, 50));

    // Step 2: POST with CNPJ
    const formData = new URLSearchParams();
    if (viewState) formData.append('__VIEWSTATE', viewState);
    if (viewStateGen) formData.append('__VIEWSTATEGENERATOR', viewStateGen);
    if (eventValidation) formData.append('__EVENTVALIDATION', eventValidation);
    if (previousPage) formData.append('__PREVIOUSPAGE', previousPage);
    
    // ASP.NET form fields
    formData.append('ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$idnContribuinte$IdentificationTypeField', '2'); // CNPJ
    formData.append('ctl00$ctl00$ctl00$Body$Main$Main$sepBusca$idnContribuinte$MaskedField', digits);
    formData.append('__ASYNCPOST', 'true');
    formData.append('__EVENTTARGET', 'Body_Main_Main_sepBusca_btnBuscar');
    formData.append('__EVENTARGUMENT', '');

    console.log('[SAT-SC] Submitting CNPJ query...');
    const postRes = await fetch(pageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookies,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': pageUrl,
      },
      body: formData.toString(),
    });

    if (!postRes.ok) {
      console.error('[SAT-SC] POST failed:', postRes.status);
      return new Response(JSON.stringify({ error: `Erro na consulta SAT/SC: ${postRes.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resultHtml = await postRes.text();
    console.log('[SAT-SC] Response length:', resultHtml.length);
    console.log('[SAT-SC] Response preview:', resultHtml.substring(0, 2000));

    // Parse the result HTML
    const result = parseResult(resultHtml);
    console.log('[SAT-SC] Parsed result:', JSON.stringify(result));

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

function extractField(html: string, fieldName: string): string {
  // Try hidden input
  const inputRegex = new RegExp(`name="${fieldName}"[^>]*value="([^"]*)"`, 'i');
  const match = html.match(inputRegex);
  if (match) return match[1];

  // Try id-based
  const idRegex = new RegExp(`id="${fieldName}"[^>]*value="([^"]*)"`, 'i');
  const match2 = html.match(idRegex);
  return match2 ? match2[1] : '';
}

function parseResult(html: string): {
  success: boolean;
  ie?: string;
  situacao?: string;
  razao_social?: string;
  error?: string;
} {
  // Check for error messages
  if (html.includes('não foi encontrado') || html.includes('Nenhum registro encontrado') || html.includes('não encontrado')) {
    return { success: false, error: 'Contribuinte não encontrado no SAT/SC' };
  }

  // The result page typically shows data in a grid/table or label fields
  // Try multiple patterns to extract IE
  let ie = '';
  let situacao = '';
  let razaoSocial = '';

  // Pattern: Look for Inscrição Estadual value in spans/labels
  const iePatterns = [
    /Inscri[çc][aã]o\s*Estadual[^<]*<[^>]*>([^<]+)/i,
    /IE[:\s]*(\d{3}\.?\d{3}\.?\d{3})/i,
    /idnInscricaoEstadual[^>]*>([^<]+)/i,
    /InscricaoEstadual[^>]*value="([^"]+)"/i,
    /IE[:\s]+<[^>]*>(\d[\d.]+)/i,
  ];

  for (const pattern of iePatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].trim()) {
      ie = match[1].trim();
      break;
    }
  }

  // Pattern: Look for Situação Cadastral
  const situacaoPatterns = [
    /Situa[çc][aã]o\s*Cadastral[^<]*<[^>]*>([^<]+)/i,
    /situacaoCadastral[^>]*>([^<]+)/i,
    /SituacaoCadastral[^>]*value="([^"]+)"/i,
    /Situa..o[:\s]*<[^>]*>(Ativ[ao]|Baixad[ao]|Suspens[ao]|Cancel[ao]d[ao]|Inapt[ao]|Nul[ao])/i,
  ];

  for (const pattern of situacaoPatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].trim()) {
      situacao = match[1].trim();
      break;
    }
  }

  // Pattern: Look for Razão Social
  const razaoPatterns = [
    /Raz[aã]o\s*Social[^<]*<[^>]*>([^<]+)/i,
    /razaoSocial[^>]*>([^<]+)/i,
    /RazaoSocial[^>]*value="([^"]+)"/i,
    /Nome[\/\s]*Raz[aã]o[^<]*<[^>]*>([^<]+)/i,
  ];

  for (const pattern of razaoPatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].trim()) {
      razaoSocial = match[1].trim();
      break;
    }
  }

  // Also try to find any tabular data with labeled rows
  // Pattern: <td>Label</td><td>Value</td>
  const tdPattern = /<td[^>]*>[^<]*(?:Inscri|IE)[^<]*<\/td>\s*<td[^>]*>([^<]+)/gi;
  if (!ie) {
    const tdMatch = tdPattern.exec(html);
    if (tdMatch) ie = tdMatch[1].trim();
  }

  const situacaoTdPattern = /<td[^>]*>[^<]*(?:Situa)[^<]*<\/td>\s*<td[^>]*>([^<]+)/gi;
  if (!situacao) {
    const tdMatch = situacaoTdPattern.exec(html);
    if (tdMatch) situacao = tdMatch[1].trim();
  }

  if (!ie && !situacao) {
    // Return raw HTML snippet for debugging
    return {
      success: false,
      error: 'Não foi possível extrair dados do SAT/SC. Verifique os logs.',
    };
  }

  return {
    success: true,
    ie: ie || undefined,
    situacao: situacao || undefined,
    razao_social: razaoSocial || undefined,
  };
}
