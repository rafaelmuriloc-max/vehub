

# Fix SITFIS: implementar espera (tempoEspera) antes de obter o protocolo

## Problema

A API SERPRO para `SOLICITARPROTOCOLO91` retorna na primeira chamada:
```json
{
  "dados": "{\"tempoEspera\":30000}",
  "mensagens": [
    {"codigo":"[Sucesso-Sitfis-SC01]","texto":"A requisição foi efetuada com sucesso."},
    {"codigo":"[Aviso-Sitfis-AV02]","texto":"O limite de solicitações em processamento foi atingido. Aguarde o tempo informado no campo tempoEspera para fazer uma nova solicitação."}
  ]
}
```

O `protocoloRelatorio` **não vem na primeira resposta**. É necessário aguardar `tempoEspera` (30s) e chamar novamente para obter o protocolo.

O código atual tenta extrair `protocoloRelatorio` da primeira resposta e falha com "Protocolo não encontrado".

## Solução

### 1. Edge Function (`supabase/functions/integra-contador/index.ts`)

Na lógica de `SOLICITARPROTOCOLO91`:
- Detectar quando `dados` contém `tempoEspera` em vez de `protocoloRelatorio`
- Incluir `tempoEspera` no `sitfis_context` retornado ao frontend
- Quando o protocolo **é** retornado (na segunda chamada), cachear normalmente

Nenhuma mudança estrutural grande — apenas expor `tempoEspera` no contexto.

### 2. Frontend (`src/pages/IntegraContador.tsx`)

Na lógica de 2 etapas do SITFIS:
- Após a etapa 1, verificar se a resposta contém `tempoEspera` em vez de `protocoloRelatorio`
- Se contiver, mostrar mensagem "Aguardando protocolo... (30s)" e usar `setTimeout` para esperar o tempo indicado
- Após a espera, chamar `SOLICITARPROTOCOLO91` novamente para obter o protocolo
- Se a segunda tentativa também retornar `tempoEspera`, repetir (com limite de tentativas, ex: 3)
- Quando finalmente obtiver o `protocoloRelatorio`, prosseguir com a etapa 2 (`RELATORIOSITFIS92`)

```typescript
// Pseudo-código do fluxo
let protocolo = null;
let tentativas = 0;
const maxTentativas = 3;

while (!protocolo && tentativas < maxTentativas) {
  const step1 = await chamarSolicitarProtocolo();
  const dados = parseDados(step1);
  
  if (dados.protocoloRelatorio) {
    protocolo = dados.protocoloRelatorio;
  } else if (dados.tempoEspera) {
    setLoadingMessage(`Aguardando processamento... (${dados.tempoEspera / 1000}s)`);
    await sleep(dados.tempoEspera);
    tentativas++;
  } else {
    throw new Error('Resposta inesperada');
  }
}
```

## Arquivos

| Arquivo | Mudança |
|---------|--------|
| `supabase/functions/integra-contador/index.ts` | Expor `tempoEspera` no `sitfis_context` quando presente |
| `src/pages/IntegraContador.tsx` | Loop de espera + retry para obter protocolo antes da etapa 2 |

