---
name: Página Pessoal
description: Controle de funcionários dos clientes com sincronização de pasta do Google Drive
type: feature
---
Página `/personnel` (`src/pages/Personnel.tsx`, item "Pessoal" no menu) lista empresas ativas com busca por nome/CNPJ/código SCI; ao clicar, expande a relação de funcionários.

- Tabelas: `client_employees` (client_id, full_name, cpf, position, admission_date, salary, termination_date, status, source) com índice único (client_id, cpf); `employee_documents` (dedupe por `drive_file_id`, status imported/pending_review/error); `employee_sync_config` (uma pasta do Drive; só admin altera).
- Cadastro/edição/desligamento manual; dados manuais nunca são sobrescritos pela sincronização (só campos vazios são complementados).
- Edge function `employee-folder-sync` (manual, botão "Sincronizar pasta"): BFS recursivo no gateway `google_drive`, empresa por CNPJ (caminho ou conteúdo do PDF) / razão social na pasta.
- PDFs têm o texto extraído com `npm:unpdf` e a IA (`gemini-2.5-flash`, tool `extract_employees`) devolve TODOS os funcionários do arquivo — uma ficha de registro com várias pessoas cria/atualiza todas e o mesmo arquivo fica vinculado a cada uma (`employee_documents` único por `(drive_file_id, employee_id)`). PDF escaneado sem texto → "aguardando revisão".
- Upload no bucket `documents` em `${clientId}/pessoal/${employeeId}/${sanitizeFileName(nome)}`; limite 20 MB, 60 arquivos/execução; nada é excluído.
- Arquivos sem identificação ficam "aguardando revisão" e aparecem em card próprio na página.
