

# Revincular documentos existentes a obrigações em aberto

## Problema
Documentos importados antes da lógica de vinculação automática (ou que falharam no vínculo) estão sem `linked_obligation_id`, mesmo havendo obrigações correspondentes em aberto.

## Solução
Adicionar um botão "Revincular Documentos" na tela de Documentos que percorre todos os documentos sem vínculo e tenta associá-los às obrigações em aberto, usando a mesma lógica já existente: cruzar `document_type_id` com `obligation_activities` (type=document) e depois encontrar `obligation_instances` pelo `client_id` + `reference_month`.

## Mudanças

### `src/pages/Documents.tsx`
1. Adicionar botão "Revincular" ao lado do botão "Enviar Arquivo"
2. Nova função `relinkDocuments()`:
   - Filtra documentos com `linked_obligation_id === null`
   - Para cada documento sem vínculo:
     - Busca `obligation_activities` com `type=document` e `document_type_id` igual ao do documento
     - Busca `obligation_instances` com mesmo `client_id` e `reference_month`
     - Se encontrar: atualiza `obligation_activity_completions` (marca completo com `file_url`) e salva `linked_obligation_id` no documento
   - Exibe toast com contagem de documentos vinculados
3. Loading state durante o processo

## Detalhes técnicos
- Reutiliza a mesma lógica de matching de `importDocument`, mas opera sobre documentos já salvos
- Busca todos os `obligation_activities` de tipo document de uma vez (otimizado)
- Busca todas as `obligation_instances` relevantes em batch
- Nenhuma migração necessária

