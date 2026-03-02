

## Sistema de Gestão de Escritório de Contabilidade

### 1. Autenticação e Perfis
- Login/cadastro com email e senha
- Perfis de usuário com nome, avatar e cargo
- Sistema de permissões: **Admin** (acesso total) e **Funcionário** (acesso restrito às próprias tarefas e dados limitados)
- Tabela separada de roles para segurança

### 2. Gestão de Clientes
- Cadastro completo de clientes (razão social, CNPJ/CPF, contato, endereço, responsável)
- Status do cliente: Ativo, Inativo, Churned
- Histórico de entrada/saída de clientes com datas
- Indicadores tipo SaaS: **taxa de churn**, **MRR**, **clientes ativos vs. inativos**, **crescimento líquido**

### 3. Módulo Financeiro
- **Contas a pagar/receber**: lançamentos com valor, vencimento, categoria, status (pendente/pago/vencido), cliente vinculado
- **Fluxo de caixa**: visão de entradas e saídas por período com gráficos (Recharts)
- **Relatórios financeiros**: dashboard com resumo mensal, receita recorrente, inadimplência, indicadores SaaS
- Categorias financeiras personalizáveis

### 4. Gestão de Tarefas
- **Kanban**: quadro com colunas "A fazer", "Em andamento", "Em revisão", "Concluído"
- **Lista com filtros**: por status, responsável, prazo, cliente vinculado
- **Calendário**: visualização mensal/semanal das tarefas com prazos
- Atribuição a membros da equipe
- Prazos com indicação visual de atrasos (cores vermelho/amarelo/verde)
- Prioridade (baixa, média, alta, urgente)

### 5. Dashboard Principal
- Cards com métricas: receita do mês, despesas, saldo, tarefas pendentes
- Gráficos de fluxo de caixa e evolução de clientes
- Tarefas vencendo hoje/atrasadas
- Indicadores SaaS: churn rate, MRR, crescimento líquido

### 6. Estrutura do Banco (Supabase)
- Tabelas: profiles, user_roles, clients, financial_entries, financial_categories, tasks, task_assignments
- RLS em todas as tabelas com controle admin/funcionário
- Triggers para criação automática de perfil no cadastro

### 7. Layout e Navegação
- Sidebar com menu: Dashboard, Clientes, Financeiro, Tarefas, Calendário
- Design limpo e profissional com tema claro
- Responsivo para uso em desktop e tablets

