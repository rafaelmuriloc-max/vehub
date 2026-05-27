## Objetivo
Adicionar uma flag de **suspensão de serviços** nos clientes e refletir essa suspensão no calendário de obrigações através de uma nova aba **"Suspensos"**.

## 1. Banco de dados
Migração na tabela `clients`:
- Nova coluna `services_suspended boolean NOT NULL DEFAULT false`
- Nova coluna `services_suspended_at timestamptz NULL` (data da suspensão, usada como corte)

Não vou alterar `obligation_instances` — a aba será derivada por join com `clients.services_suspended`.

## 2. UI – Cadastro de Clientes (`src/pages/Clients.tsx`)
- Adicionar switch **"Suspender serviços (inadimplência)"** no dialog de edição, ao lado de Status.
- Mostrar badge laranja **"Suspenso"** na linha da tabela quando ativo.
- Filtro extra: opção "Suspensos" no filtro de status.
- Ao marcar/desmarcar, gravar `services_suspended` e `services_suspended_at = now()` (ou `null`).

## 3. UI – Calendário (`src/pages/CalendarView.tsx`)
Na seção de Tabs (linha ~998), passar de 2 para 3 colunas:
- Pendentes
- Concluídas
- **Suspensos** (nova)

Lógica de classificação por obrigação (instance):
- Buscar `clients.services_suspended` junto com instâncias.
- Uma instância vai para **Suspensos** quando:
  - cliente está com `services_suspended = true`, **e**
  - a data atual já passou do "dia inicial da obrigação" — interpretado como `target_day` (ou, na ausência, o 1º dia do mês de referência). Antes desse dia, segue em Pendentes normalmente.
- Instâncias suspensas saem das abas Pendentes/Concluídas.
- Aba Suspensos lista: cliente, obrigação, vencimento, mês ref., com badge "Suspenso".

A automação "no dia inicial" é puramente derivada (cálculo no frontend ao montar as listas) — sem cron, sem alterar status no DB, então funciona automaticamente conforme a data avança.

## 4. Impactos colaterais
- Métricas existentes (MRR, contagem de ativos) não mudam — suspenso continua `status='active'` mas com flag separada. (Posso opcionalmente excluir suspensos do MRR — me avise se quiser.)
- Geração de novas instâncias (`retention-obligation-generate` etc.) **não** é alterada: continuam sendo criadas, apenas ficam visualmente segregadas.

## Detalhes técnicos
- Tipo `Client` em `Clients.tsx` ganha `services_suspended` e `services_suspended_at`.
- `CalendarView` faz join `clients(services_suspended)` no select de instâncias e particiona o array antes de renderizar cada TabsContent.
- Aba Suspensos usa o mesmo layout de tabela das outras, com coluna extra "Suspenso desde".
