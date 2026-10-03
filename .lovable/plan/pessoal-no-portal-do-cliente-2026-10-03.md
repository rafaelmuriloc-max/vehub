# Pessoal no portal do cliente

Nova aba **Pessoal** no portal do cliente (no menu de baixo do celular e nas abas do computador). Ela mostra os dados de pessoal da empresa escolhida no seletor. Cada cliente só vê as empresas em que o e-mail dele está cadastrado como contato.

## O que o cliente vê
- **Cartões:** funcionários ativos, total de salários, experiências vencendo nos próximos 30 dias e férias vencendo nos próximos 60 dias.
- **Gráficos de evolução:** quantidade de funcionários (barras) e total de salários (linha), mês a mês.
- **Lista de funcionários:** código, nome, cargo, admissão, salário e situação (ativo ou demitido, com a data da demissão), com busca e filtro por situação. No celular cada funcionário aparece como um cartão.
- **Contratos de experiência:** para cada funcionário ativo em experiência, mostra o 1º período (dias e data de fim) e a prorrogação (dias e data de fim).
  - Situação de cada um: "Vence em X dias" (vermelho até 7 dias, laranja até 30), "Vencido" ou "Encerrado".
  - Filtro: a vencer, vencidos e todos.
  - Lista ordenada pela data mais próxima.
- **Férias:** período aquisitivo, dias de direito, gozo e data limite de cada funcionário. Os vencidos ficam em vermelho e os que estão perto de vencer, em laranja.

## O que não aparece
- Documentos dos funcionários.
- CPF completo. Só aparecem os 3 últimos dígitos, por exemplo `***.***.*12-34`.
- Observações internas do escritório.
- Nenhuma edição: tudo é só leitura, e nada muda para a equipe.

## Segurança
Os clientes continuam sem acesso direto às tabelas de pessoal. Os dados chegam por consultas protegidas que primeiro conferem se aquele usuário tem acesso à empresa. Se não tiver, a consulta volta vazia.

## Technical details
- Migração com RPCs security-definer, `stable`, `search_path=public`, que retornam vazio quando `portal_can_access_client(auth.uid(), _client_id)` é falso:
  - `portal_employees(_client_id)`: colunas de client_employees sem `notes`, com CPF mascarado e incluindo `trial_end_1`, `trial_days_1`, `trial_end_2`, `trial_days_2`.
  - `portal_payroll(_client_id)`: competence, active_count, admitted/dismissed, qty_employees, gross, net, fgts/inss.
  - `portal_vacations(_client_id)`: colunas de employee_vacation_periods mais o nome do funcionário.
  - `REVOKE ALL FROM public, anon`; `GRANT EXECUTE TO authenticated`.
- Frontend: novo `src/components/portal/PortalPersonnel.tsx`, com gráficos em recharts e as seções Cartões, Gráficos, Funcionários, Experiências e Férias. Adicionar a aba "Pessoal" em `Portal.tsx` (com ícone Users) e a opção no menu de baixo.
- Funções puras em `src/lib/portalPersonnel.ts`: máscara de CPF, situação da experiência (próximo fim entre o 1º período e a prorrogação, vencido/encerrado, faixas de 7 e 30 dias) e alerta de férias de 60 dias. Testes em vitest para cada regra.
- AGENTS.md: acrescentar as RPCs de pessoal à regra de leitura do portal por RPCs.
