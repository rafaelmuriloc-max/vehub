

# Exibir mensagem de erro detalhada do Integra Contador

## Problema
A edge function retorna 400 com mensagem explicativa ("Certificado do contador configurado, mas faltam: CPF do contador"), mas o `supabase.functions.invoke()` descarta o body em respostas não-2xx e lança erro genérico "Edge Function returned a non-2xx status code".

## Solução

### Arquivo: `supabase/functions/integra-contador/index.ts`
Mudar os erros de validação (400) para retornar **status 200** com `{ success: false, error: "..." }` em vez de status HTTP 400. Isso permite que o SDK do Supabase entregue o body ao frontend.

Alterações nas linhas 95-101 e 111-113:
- Trocar `jsonResponse({...}, 400)` por `jsonResponse({ success: false, error: "..." }, 200)`
- Manter o mesmo padrão já usado para erros da API SERPRO (que retornam 200 com `success: false`)

### Arquivo: `src/pages/IntegraContador.tsx`
Nenhuma alteração necessária — o código na linha 290 já trata `data?.error` quando `data?.success` é false.

## Resultado
O toast e o painel de resultado mostrarão a mensagem real: "Certificado do contador configurado, mas faltam: CPF do contador. Complete a configuração em Configurações > Meu Escritório."

