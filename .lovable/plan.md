# Remover integração SEF-SC (não há WS oficial p/ saídas)

O teste com o cliente EDSON JOSE KOSKUR (CNPJ 11.160.873/0001-88) confirmou que o endpoint `nfedownloadV2.asmx` da SEFAZ-SC **não expõe a operação `nfeDownloadContab`** (HTTP 500: *Server did not recognize the value of HTTP Header SOAPAction*). O caminho proposto não é viável — vamos limpar o código para não deixar opção quebrada na UI.

## Mudanças

**1. `supabase/functions/nfe-query/index.ts`**
- Remover parâmetro `provider` do body e toda a ramificação `sefaz-sc`.
- Remover constantes `SC_URL`, `SC_NS`, `SC_SOAP_ACTION`.
- Remover função `parseScDistEntries` e o loop SEF-SC.
- Remover leitura/atualização de `last_sefazsc_nsu`.
- Voltar à leitura simples do certificado A1 do próprio cliente (caminho AN).

**2. `src/components/invoices/NfeTab.tsx`**
- Remover state `syncProvider` e o `<Select>` de "Origem".
- Remover o aviso sobre procuração SAT-SC.
- Remover envio de `provider` na chamada de `supabase.functions.invoke('nfe-query', …)`.
- Voltar texto do toast para o original ("Ambiente Nacional indisponível").

**3. Migração de banco**
- `ALTER TABLE public.clients DROP COLUMN IF EXISTS last_sefazsc_nsu;`
- A coluna foi adicionada nesta semana e está sempre `NULL` — drop seguro.

## Memória
- Adicionar memória `constraint`: *"SEFAZ-SC não tem WS de NF-e de saída para contadores. `nfeDownloadContab` não existe. Para saídas em SC: scraping DFE-SC com login do cliente, ERP, ou upload manual."* — para não tentarmos de novo.
- Atualizar a entrada de **NFe Management** para refletir que apenas AN/entradas é suportado.

## Fora de escopo
- Implementar scraping do portal DFE-SC (fica para outra rodada, se quisermos).
- Mexer no `proxy-nfe.php` no Hostinger (não foi alterado para SC nesta rodada — nada a reverter lá).
