## Adicionar seletor de período na busca de NF-e

Atualmente o botão "Consultar" no card de sincronização (`NfeTab.tsx`) busca tudo via NSU sequencial, sem opção de período. O serviço `nfeDistribuicaoDFe` não filtra por data nativamente (só por NSU), então o período será aplicado ao salvar/parar o loop.

### Mudanças

**1. UI — `src/components/invoices/NfeTab.tsx` (Card "Consultar NF-e")**

Adicionar ao lado do seletor de cliente:
- Select "Período de busca" com opções:
  - Últimos 90 dias (padrão — limite máximo do AN)
  - Este mês
  - Mês anterior
  - Personalizado (libera dois inputs `date`: De / Até)

Os valores `syncDateFrom` / `syncDateTo` são enviados ao edge function junto com `client_id`.

**2. Edge function — `supabase/functions/nfe-query/index.ts`**

- Aceitar `date_from` e `date_to` (YYYY-MM-DD) opcionais no body.
- Quando `date_from` for informado, **iniciar o loop com `lastNsu = "0"`** (ignorar `last_nfe_nsu` salvo) para garantir varredura completa dentro do período.
- Em `parseNfeEntry`, descartar entradas cuja `issue_date` esteja fora do intervalo (`< date_from` ou `> date_to`). Eventos (sem `issue_date`) continuam sendo salvos se a chave de acesso já existir.
- Não atualizar `last_nfe_nsu` quando uma busca por período for executada (evita "perder" NSU para a próxima sync incremental sem filtro).
- Encerrar o loop antecipadamente se todas as entradas do lote forem mais antigas que `date_from` E `ultNSU >= maxNSU - 0` (heurística: se já passamos do período, paramos).

**3. Comportamento**

- Sem período selecionado → comportamento atual (incremental por NSU).
- Com período → varredura completa do AN filtrando por `issue_date`, sem mexer no cursor NSU.

Sem mudanças de schema, sem nova migração.