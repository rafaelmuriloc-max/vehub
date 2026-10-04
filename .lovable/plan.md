# Status de pagamento vindo do sistema do escritório

## O que muda no portal
- O status de pagamento das guias passa a vir do que o escritório já consulta no sistema:
  - **DAS do Simples Nacional**: consulta do Simples (hoje 428 competências pagas, 796 em aberto).
  - **DAS do MEI**: consulta do MEI (pago, em aberto, vencido).
  - **INSS (Darf Previdenciário)**: consulta da DCTFWeb (pago, em aberto, vencido).
- Na guia aparecem os selos **Paga** (verde, com data e valor pago), **Em aberto** ou **Vencida**, além do selo "Guia disponível" quando houver arquivo.
- Vale no menu Impostos, em Vencimentos Próximos e no Calendário Fiscal. Guias pagas saem de "Próximos vencimentos" e do contador do cartão.
- Os outros impostos (ISS, ICMS, PIS/COFINS, IRPJ/CSLL, FGTS) não têm consulta de pagamento no sistema; seguem só com "Guia disponível" / "Em preparação".
- O status é o da última consulta feita pelo escritório; não há consulta nova ao abrir o portal (sem custo extra no SERPRO).

## Detalhes técnicos
- Migração: nova RPC security-definer `portal_tax_payments(_client_id, _from, _to)` devolvendo `fonte` ('SN' | 'MEI' | 'DCTFWEB'), `competencia`, `status`, `valor`, `valor_pago`, `data_pagamento`, `data_vencimento`, com checagem `portal_can_access_client`; REVOKE public/anon, GRANT authenticated. Isso substitui a leitura direta de `simples_nacional_competencias` no portal (bloqueada ao cliente pela guarda).
- Ligação: SN/MEI → itens da aba DAS; DCTFWeb (categoria GERAL_MENSAL) → itens INSS; casamento pela competência (`competenciaFromDue(due)` = competência gravada, MM/AAAA). Competências da consulta sem tarefa correspondente entram como item próprio.
- Helper puro `paymentFor(item, payments)` em `src/lib/portalDashboard.ts` com testes (DAS pago, INSS vencido, ISS sem status).
- Ajustes em `PortalImpostos.tsx`, `Portal.tsx` (dues/upcoming) e `PortalWidgets.tsx` (selo).
