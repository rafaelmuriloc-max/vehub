
## Visão geral

Nova aba **Simples Nacional** dentro de `/fiscal`, listando todos os clientes ativos com `tax_regime = 'Simples Nacional'`. Cada linha mostra RBT12 e percentuais de consumo dos sublimites (RBA/sublimite × 100). Ao expandir, aparecem as 12 competências do ano corrente com valor do DAS, status, e botões de ações via Integra Contador (SERPRO).

Sincronização automática mensal todo **dia 20 às 23:59 (BRT)** via CRON, alimentando uma tabela de cache.

## Mudanças no banco

Nova tabela `simples_nacional_competencias`:

- `client_id`, `competencia` (date — 1º dia do mês), `ano`
- `rbt12`, `rba_acumulado_ano`
- `valor_das`, `numero_das`, `numero_declaracao`
- `data_vencimento`, `data_pagamento`, `status` ('pago' | 'aberto' | 'sem_movimento')
- `das_pdf_base64`, `declaracao_pdf_base64`, `comprovante_pdf_base64` (cache leve)
- `last_synced_at`, `raw_response` (jsonb)
- `created_at`, `updated_at`
- Unique: (client_id, competencia)
- RLS: SELECT autenticado; INSERT/UPDATE/DELETE só admins + service_role
- GRANTs corretos para `authenticated` e `service_role`

CRON job (`pg_cron` + `pg_net`) agendado para `59 23 20 * *` no fuso `America/Sao_Paulo` (configurado no SQL com `TZ`), chamando edge function `simples-nacional-sync`.

## Edge functions (novas)

1. **`simples-nacional-sync`** — varre todos os clientes Simples ativos, para cada um chama PGDASD `CONSDECLARACAO13` (declarações do ano), `GERARDAS12` (DAS por período) e atualiza/insere registros em `simples_nacional_competencias`. Marca `status='pago'` quando há `data_pagamento` no extrato (`CONSEXTRATO16`). Suporta execução por CRON e manual (botão "Sincronizar agora" no header da aba, apenas admin).

2. **`simples-nacional-action`** — endpoint único acionado pelos botões da UI, encaminhando para o `integra-contador` existente:
   - `gerar_guia` → PGDASD/GERARDAS12 (PDF)
   - `recalcular` → PGDASD/TRANSDECLARACAO11 (reabre/retransmite e re-emite DAS)
   - `ultima_declaracao` → PGDASD/CONSULTIMADECREC14 ou CONSDECLARACAO13 (PDF)
   - `comprovante` → PGDASD/CONSEXTRATO16 (apenas se status=pago)
   Retorna PDF base64 e atualiza a linha em `simples_nacional_competencias`.

Ambas usam o certificado A1 do escritório (já configurado em `company_settings.accountant_certificate_*`) seguindo o padrão SERPRO/SITFIS existente.

## Frontend

- **`src/pages/Fiscal.tsx`** — adicionar botão "Simples Nacional" (ícone `Calculator`) entre Situação Fiscal e Notas Fiscais, com nova view `simples`.
- **`src/components/simples-nacional/SimplesNacionalTab.tsx`** (novo) — tabela principal:
  - Busca por nome/CNPJ
  - Colunas: Nome, CNPJ (formatado `XX.XXX.XXX/XXXX-XX`), RBT12 (R$), % sublimite 3,6Mi (RBA/3.600.000), % sublimite 4,8Mi (RBA/4.800.000) com barra de progresso colorida (verde <80%, amarelo 80-100%, vermelho >100%)
  - Header com botão "Sincronizar agora" (admin) e badge "Última sync: dd/mm às hh:mm"
  - Linhas expansíveis (Collapsible) — ao abrir, carrega/exibe 12 competências do ano vigente
- **`src/components/simples-nacional/CompetenciaRow.tsx`** (novo) — linha de competência:
  - Mês/Ano (jan/2026…)
  - Valor DAS (R$ ou "—")
  - Status (badge: Pago verde / Em aberto laranja / Sem movimento cinza)
  - Botões: Gerar Guia, Recalcular, Última Declaração, Comprovante (este só se pago)
  - Cada botão chama `simples-nacional-action`, mostra toast e abre PDF em nova aba (base64 → blob)
- Seletor de ano no topo da expansão (default = ano corrente)
- Responsivo: em mobile esconde colunas RBT12/sublimites secundárias

## Detalhes técnicos

- Percentuais: `RBA_acumulado_ano / 3_600_000` e `/ 4_800_000`. Quando RBA não disponível, mostrar "—".
- Status derivado: `data_pagamento != null` → pago; caso contrário, com base na data atual vs vencimento.
- PDFs: padrão `Serpro Results UI` já em uso — abrir blob a partir de base64.
- Loading skeletons na tabela e nas competências.
- Toda chamada SERPRO usa o pattern de fallback/retry do `SERPRO SITFIS Automation`.

## Memória

Adicionar `mem://features/fiscal/simples-nacional-control` descrevendo a aba, tabela de cache, CRON dia 20 23:59, e mapeamento de ações SERPRO.

## Fora de escopo

- Edição manual de RBT12/declaração (somente leitura + ações SERPRO).
- DEFIS anual (já existe em IntegraContador).
- Histórico multi-ano além do seletor (mantém 1 ano por vez).
