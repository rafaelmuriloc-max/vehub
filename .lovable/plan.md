

# Vincular documentos a obrigações e mostrar na lista

## Resumo
Ao importar um documento, o sistema já vincula a `obligation_activity_completions`. A mudança adiciona uma coluna `linked_obligation_id` na tabela `documents` para registrar diretamente qual obrigação foi vinculada, e exibe essa informação na listagem.

## Mudanças

### 1. Migração SQL
- Adicionar coluna `linked_obligation_id uuid` (nullable) na tabela `documents`

### 2. `src/pages/Documents.tsx`
- Carregar `obligations` (id, name) no `loadAll()`
- Na função `importDocument`, após vincular a `obligation_activity_completions`, salvar o `obligation_id` encontrado no registro do documento (`documents.linked_obligation_id`)
- Se múltiplas obrigações forem vinculadas, salvar a primeira (ou a principal)
- Adicionar coluna "Obrigação" na tabela de documentos importados, exibindo o nome da obrigação vinculada ou "—" se nenhuma
- Tipo `Doc` atualizado para incluir `linked_obligation_id: string | null`

### 3. Lógica de vinculação (já existente, melhorada)
- A lógica atual já busca `obligation_activities` por `document_type_id` e cruza com `obligation_instances` por `client_id` + `reference_month`
- Após encontrar e vincular, o `obligation_id` da instância é gravado no documento
- O `update` no documento acontece após o `insert` inicial, usando o id retornado

## Detalhes técnicos
- Nova coluna: `ALTER TABLE documents ADD COLUMN linked_obligation_id uuid;`
- A coluna é nullable pois documentos podem ser importados sem vínculo
- Nenhuma foreign key formal (padrão do projeto)
- Após o insert do documento, capturar o `id` retornado para fazer o update com o `linked_obligation_id`

