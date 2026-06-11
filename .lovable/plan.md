## Objetivo
Criar uma flag `without_monthly_fee` no cadastro do cliente para marcar clientes que **não possuem mensalidade**. Estes clientes:
- Não entram em nenhuma estatística/financeiro (contagem de ativos, MRR, ticket médio, churn, novos no mês, gráficos históricos).
- Continuam gerando obrigações e atividades normalmente.

## Mudanças

### 1. Banco de dados (migration)
- Adicionar coluna `without_monthly_fee boolean NOT NULL DEFAULT false` em `public.clients`.

### 2. Cadastro (`src/pages/Clients.tsx`)
- Incluir o campo no estado inicial do formulário.
- Adicionar `Switch` "Cliente sem mensalidade" próximo a `monthly_value`/`start_date`.
- Quando marcado: zerar/desabilitar o campo de valor mensal visualmente.
- Persistir no insert/update.
- Exibir badge "Sem mensalidade" na listagem para identificação visual.

### 3. Estatísticas e Financeiro
Excluir `without_monthly_fee = true` em **todos** os cálculos:

- `src/pages/Clients.tsx`:
  - `activeCount` (linha ~1031)
  - `mrr` (linha ~1033)
  - Ticket médio (mrr / activeCount) — passa a ignorar esses clientes automaticamente.
- `src/components/dashboard/ClientsPanel.tsx`:
  - 4 queries: ativos, inativos, novos no mês, churn → adicionar `.eq('without_monthly_fee', false)`.
- `src/pages/Financial.tsx`:
  - `activeClients`/`mrr` (linhas ~117, 165) e série histórica "Evolução do MRR" (linhas ~148-165).
- Gráficos do Dashboard Analytics (histórico de clientes/MRR) — aplicar mesmo filtro.

### 4. Obrigações/Atividades
- Sem alteração — fluxo de geração de obrigações e atividades segue inalterado.

## Verificação
- Criar cliente marcado como "sem mensalidade" → não soma em Ativos, MRR nem ticket médio (Clientes, Financeiro e Dashboard), mas aparece nas obrigações.
- Desmarcar a flag → volta a contar em todas as estatísticas.