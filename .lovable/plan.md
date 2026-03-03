

## Plano: Reestruturar Obrigações e adicionar Gestão de Documentos

### 3 mudanças principais

---

### 1. Eliminar instâncias e mover obrigações para aba no cadastro do cliente

A página `/obligations` passa a ser apenas o **cadastro de obrigações e atividades** (definições). O acompanhamento por empresa vai para uma nova aba **"Obrigações"** dentro do Dialog de edição do cliente em `Clients.tsx`.

**Tabela `obligation_instances`** — será substituída por uma abordagem mais simples:
- Nova tabela `client_obligations` com `client_id`, `obligation_id`, `reference_month`, `status`, `due_date`
- Reutiliza `obligation_activity_completions` vinculada a `client_obligation_id` em vez de `instance_id`

Ou mais simples: **manter as tabelas existentes** (`obligation_instances` e `obligation_activity_completions`), mas a gestão passa a ser feita dentro do cadastro do cliente, não na página Obligations.

**Mudanças:**
- **`src/pages/Obligations.tsx`**: Remover a aba "Acompanhamento" e toda a lógica de instâncias. Manter apenas o cadastro de obrigações + atividades.
- **`src/pages/Clients.tsx`**: Adicionar aba "Obrigações" (grid-cols passa de 7 para 8 com contrato, ou reorganizar). Dentro dessa aba, o admin pode gerar competências mensais para aquele cliente e marcar atividades como concluídas. Atividades do tipo `document` terão botão de upload/download de arquivo.
- **Novo componente `src/components/ClientObligationsTab.tsx`**: Recebe `clientId`, carrega obrigações/atividades/completions daquele cliente, permite criar competência, marcar conclusões, anexar documentos.

---

### 2. Cadastro de Tipo de Documento

Nova tabela `document_types`:
- `id` uuid PK, `name` text, `description` text, `created_at` timestamp

Nova página `src/pages/DocumentTypes.tsx` (ou dentro de Settings) com CRUD simples de tipos de documento.

Adicionar link no sidebar ou em Settings.

---

### 3. Importação de Documentos

Nova tabela `documents`:
- `id` uuid PK, `document_type_id` uuid FK→document_types, `client_id` uuid FK→clients, `reference_month` date, `file_url` text, `file_name` text, `uploaded_by` uuid, `created_at` timestamp

Nova página `src/pages/Documents.tsx`:
- Upload de documentos com seleção de tipo, cliente e competência
- Na importação, o sistema busca a obrigação que tem uma atividade do tipo `document` correspondente ao tipo de documento e à competência, e marca automaticamente como concluída (cria/atualiza `obligation_activity_completions`).

Adicionar "Documentos" e "Tipos de Documento" no sidebar.

---

### Storage

Criar bucket `documents` (público: não) para armazenar os arquivos importados.

---

### Resumo de alterações

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `document_types`, `documents`; adicionar `document_type_id` em `obligation_activities`; criar bucket `documents` |
| `src/pages/Obligations.tsx` | Remover aba Acompanhamento e lógica de instâncias |
| `src/components/ClientObligationsTab.tsx` | Novo — aba de obrigações dentro do cliente |
| `src/pages/Clients.tsx` | Adicionar aba "Obrigações" com o novo componente |
| `src/pages/Documents.tsx` | Novo — importação de documentos com auto-associação |
| `src/components/AppSidebar.tsx` | Adicionar "Documentos" no menu |
| `src/pages/Settings.tsx` | Adicionar aba "Tipos de Documento" |
| `src/App.tsx` | Adicionar rota `/documents` |

### Fluxo de auto-associação na importação
1. Usuário seleciona tipo de documento, cliente e competência e faz upload
2. Sistema salva na tabela `documents`
3. Sistema busca atividades do tipo `document` com `document_type_id` correspondente, e instâncias daquele cliente/competência
4. Marca o `obligation_activity_completions` como concluído com `file_url`

