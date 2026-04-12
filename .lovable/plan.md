

# Fix SITFIS: protocolo não retornado em resposta 304

## Problema

A API SERPRO retorna o `protocoloRelatorio` **apenas no primeiro request** (status 200). Nos requests seguintes, retorna 304 com **body vazio**. O frontend tenta extrair o protocolo do body vazio e falha com "Protocolo não encontrado na resposta da etapa 1".

Resposta real capturada na rede:
```json
{"success":true,"status":304,"data":"","client_name":"...","service":{...}}
```

## Solução

Cachear o protocolo no banco de dados quando a resposta é 200, e recuperá-lo do cache quando a resposta é 304.

### 1. Edge Function (`supabase/functions/integra-contador/index.ts`)

Após receber a resposta da API SERPRO, se o serviço for `SOLICITARPROTOCOLO91`:
- **Status 200**: extrair `protocoloRelatorio` da resposta e salvar no Supabase (tabela `integra_contador_cache`) com chave = `sitfis_protocolo:{contribuinte_cnpj}`, TTL de 24h
- **Status 304**: buscar o protocolo cacheado da tabela `integra_contador_cache` e incluí-lo na resposta retornada ao frontend

Isso garante que o frontend sempre receba o protocolo, independente do status.

### 2. Migração — criar tabela de cache

```sql
create table public.integra_contador_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  cache_value text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

alter table public.integra_contador_cache enable row level security;

-- Cleanup de registros expirados (opcional, pode ser feito via cron)
create index idx_integra_cache_key on public.integra_contador_cache(cache_key);
create index idx_integra_cache_expires on public.integra_contador_cache(expires_at);
```

### 3. Edge Function — lógica de cache (após linha 790)

```typescript
// Após obter responseData, se for SOLICITARPROTOCOLO91:
if (idServico === 'SOLICITARPROTOCOLO91') {
  if (apiResponse.status >= 200 && apiResponse.status < 300) {
    // Extrair protocolo e cachear
    const dados = responseData?.dados || responseData?.pedidoDados?.dados;
    let protocolo = '';
    if (typeof dados === 'string') {
      try { protocolo = JSON.parse(dados).protocoloRelatorio; } catch {}
    }
    if (protocolo) {
      const contribuinteCnpj = requestBody.contribuinte?.numero;
      await supabaseAdmin.from('integra_contador_cache')
        .upsert({
          cache_key: `sitfis_protocolo:${contribuinteCnpj}`,
          cache_value: protocolo,
          expires_at: new Date(Date.now() + 24*60*60*1000).toISOString()
        }, { onConflict: 'cache_key' });
    }
  } else if (apiResponse.status === 304) {
    // Buscar protocolo do cache
    const contribuinteCnpj = requestBody.contribuinte?.numero;
    const { data: cached } = await supabaseAdmin
      .from('integra_contador_cache')
      .select('cache_value')
      .eq('cache_key', `sitfis_protocolo:${contribuinteCnpj}`)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    
    if (cached) {
      // Incluir protocolo na resposta para o frontend
      responseData = {
        ...responseData,
        dados: JSON.stringify({ protocoloRelatorio: cached.cache_value })
      };
    }
  }
}
```

### 4. Frontend (`src/pages/IntegraContador.tsx`)

Também buscar o protocolo de `step1.data?.data?.dados` (quando a edge function injeta no 304) e de `step1.data?.dados` (resposta direta 200). A extração atual já cobre esses paths, mas adicionar fallback para `step1.data?.data` como objeto direto:

```typescript
// Adicionar mais caminhos de extração
const responseObj = step1.data?.data;
if (typeof responseObj === 'object' && responseObj?.dados) {
  // ...parse dados
}
// Também tentar step1.data?.dados diretamente
```

### 5. Logging adicional na Edge Function

Adicionar `console.log` do body bruto para SITFIS para facilitar debug futuro:
```typescript
console.log(`[SITFIS] Raw response body: ${apiResponse.bodyText?.substring(0, 500)}`);
```

## Arquivos

| Arquivo | Mudança |
|---------|--------|
| Nova migração SQL | Criar tabela `integra_contador_cache` |
| `supabase/functions/integra-contador/index.ts` | Cache de protocolo (salvar no 200, recuperar no 304) + logging |
| `src/pages/IntegraContador.tsx` | Melhorar extração do protocolo com mais fallbacks |

