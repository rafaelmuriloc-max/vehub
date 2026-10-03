# Pessoal no portal do cliente

Nova aba **Pessoal** no portal do cliente (no menu de baixo do celular e nas abas do computador). Ela mostra os dados de pessoal da empresa escolhida no seletor. Cada cliente só vê as empresas em que o e-mail dele está cadastrado como contato.

## O que o cliente vê
- **Cartões:** funcionários ativos, total de salários, experiências vencendo nos próximos 30 dias e férias vencendo nos próximos 60 dias.
- **Gráficos de evolução:** quantidade de funcionários (barras) e total de salários (linha), mês a mês, com os mesmos números do resumo da folha que a página Pessoal usa.
- **Lista de funcionários:** código, nome, cargo, admissão, salário e situação (ativo ou demitido, com a data da demissão), com busca e filtro por situação. No celular cada funcionário aparece como um cartão.
- **Férias:** período aquisitivo, dias de direito, gozo e data limite de cada funcionário. Os vencidos ficam em vermelho e os que estão perto de vencer, em laranja.
- **Documentos do funcionário:** ao tocar em um funcionário, aparecem os documentos dele (vindos do Drive) com Visualizar e Baixar, por links temporários.

## O que não aparece
- CPF completo. Só aparecem os 3 últimos dígitos, por exemplo `***.***.*12-34`.
- Observações internas do escritório.
- Arquivos que ainda estão em revisão ou com erro.
- Nenhuma edição: tudo é só leitura, e nada muda para a equipe.

## Segurança
Os clientes continuam sem acesso direto às tabelas de pessoal. Os dados chegam por consultas protegidas que primeiro conferem se aquele usuário tem acesso à empresa. Se não tiver, a consulta volta vazia.

## Technical details
- Migração com RPCs security-definer, `stable`, `search_path=public`, que retornam vazio quando `portal_can_access_client(auth.uid(), _client_id)` é falso:
  - `portal_employees(_client_id)`: colunas de client_employees sem `notes`, CPF mascarado.
  - `portal_payroll(_client_id)`: competence, active_count, admitted/dismissed, qty_employees, gross, net, fgts/inss.
  - `portal_vacations(_client_id)`: colunas de employee_vacation_periods mais o nome do funcionário.
  - `portal_employee_documents(_client_id)`: id, employee_id, file_name, storage_path, doc_kind; somente arquivos com status ok.
  - `REVOKE ALL FROM public, anon`; `GRANT EXECUTE TO authenticated`.
- Storage: os arquivos ficam em `${clientId}/pessoal/...` no bucket `documents`, cobertos pela regra atual que libera ao cliente só a pasta das próprias empresas. Antes de usar, conferir essa regra e ajustá-la se ela não cobrir subpastas.
- Frontend: novo `src/components/portal/PortalPersonnel.tsx`, reaproveitando `PersonnelEvolutionChart` se ele aceitar dados por props; se não aceitar, usar uma versão leve com recharts. Adicionar a aba "Pessoal" em `Portal.tsx` (com ícone Users) e a opção no menu de baixo. Mostrar mensagens de "sem dados" quando estiver vazio.
- Funções puras (máscara de CPF, alertas de experiência e férias) em `src/lib/portalPersonnel.ts`, com testes em vitest: máscara, janela de 30 e 60 dias, vencido versus a vencer.
- AGENTS.md: acrescentar as RPCs de pessoal à regra de leitura do portal por RPCs.
