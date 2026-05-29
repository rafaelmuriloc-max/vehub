---
name: Simples Nacional Control
description: Aba Fiscal > Simples Nacional com controle de RBT12, sublimites e DAS por competência
type: feature
---
Aba **Simples Nacional** em `/fiscal` (`SimplesNacionalTab.tsx` + `CompetenciaRow.tsx`).

Tabela `simples_nacional_competencias` (unique client_id+competencia) faz cache de RBT12, RBA acumulada do ano, valor/numero DAS, número da declaração, status (pago | aberto | sem_movimento) e PDFs (das_pdf_base64, declaracao_pdf_base64, comprovante_pdf_base64).

Sublimites: pct = RBA_acumulado_ano / 3.600.000 e / 4.800.000. Cores: verde <80%, âmbar <100%, vermelho ≥100%.

Edge function `simples-nacional-sync` chama PGDASD via `integra-contador`:
- CONSULTIMADECREC14 → declaração + RBT12/RBA
- GERARDAS12 → PDF do DAS + valor + número
- CONSEXTRATO16 → status pago + dataPagamento (se numeroDas existe)

CRON `simples-nacional-monthly-sync` agendado para `59 2 21 * * UTC` (= dia 20 às 23:59 BRT).
Botão "Sincronizar agora" só para admin; sync por empresa disponível ao expandir.

Botões por competência (CompetenciaRow):
- Gerar guia → GERARDAS12 (PDF DAS)
- Recalcular → GERARDAS12 (re-emite com valores atualizados)
- Declaração → CONSULTIMADECREC14
- Comprovante → CONSEXTRATO16 (só se status=pago, exige numero_das)

Filtros: apenas clients com `tax_regime='Simples Nacional'` e `status='active'`.
