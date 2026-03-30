

# Importação inteligente de documentos com IA

## Resumo
Remover os campos manuais (tipo de documento, cliente, competência) da tela de importação. O usuário faz apenas o upload do arquivo. Uma Edge Function usa Lovable AI para extrair CNPJ, nome da empresa, competência e tipo de obrigação do texto do PDF, usando os `document_types` cadastrados e suas `extraction_config` como referência. Com esses dados, o sistema identifica automaticamente o cliente, tipo de documento e competência, salva o documento e vincula às obrigações/tarefas em aberto.

## Fluxo do usuário
1. Usuário clica em "Enviar Arquivo" (sem preencher nada)
2. Sistema mostra loading "Analisando documento..."
3. IA extrai os dados e retorna: tipo de documento, CNPJ (→ cliente), competência
4. Se tudo for encontrado: documento é salvo e vinculado automaticamente
5. Se algo faltar: dialog de confirmação mostra o que foi encontrado e permite corrigir manualmente os campos faltantes
6. Toast confirma importação e associações feitas

## Mudanças

### 1. Nova Edge Function `supabase/functions/classify-document/index.ts`
- Recebe: texto extraído do PDF (extraído no frontend com pdf.js) + lista de `document_types` com nomes e descrições
- Usa Lovable AI (`LOVABLE_API_KEY` já disponível) com tool calling para retornar JSON estruturado:
  ```json
  {
    "cnpj": "12345678000190",
    "company_name": "Empresa XYZ",
    "reference_month": "2026-03",
    "document_type_name": "DARF"
  }
  ```
- Model: `google/gemini-3-flash-preview` (rápido e barato)
- System prompt em português explicando que é um documento fiscal/contábil brasileiro

### 2. Atualizar `src/pages/Documents.tsx`
- Remover campos obrigatórios de seleção (tipo, cliente, competência)
- No upload:
  1. Extrair texto do PDF usando `pdfjs-dist` (já instalado) via `page.getTextContent()`
  2. Chamar Edge Function `classify-document` com o texto + lista de document_types
  3. Com o CNPJ retornado, buscar cliente na tabela `clients` pelo campo `document` (CNPJ)
  4. Com o nome do tipo, buscar `document_type_id` na tabela `document_types`
  5. Montar `reference_month` a partir do retorno da IA
  6. Se todos dados encontrados → salvar e vincular automaticamente (lógica existente)
  7. Se algo faltar → mostrar dialog de revisão com campos pré-preenchidos para o usuário completar
- Suportar upload de múltiplos arquivos de uma vez

### 3. Novo componente `src/components/DocumentReviewDialog.tsx`
- Dialog que mostra os dados extraídos pela IA
- Campos editáveis: Tipo de Documento (select), Cliente (select), Competência (date)
- Dados pré-preenchidos com o que a IA encontrou
- Indicação visual de quais campos foram identificados automaticamente vs quais precisam de revisão
- Botão "Confirmar e Importar"

### 4. Vincular a obrigações E tarefas
- Manter lógica existente de vincular a `obligation_activity_completions`
- Adicionar: buscar `tasks` abertas do mesmo cliente e marcar como concluída se o título/descrição da tarefa corresponder

### 5. Atualizar `supabase/config.toml`
- Adicionar a nova função `classify-document`

## Detalhes técnicos
- Extração de texto no frontend: `pdfjs-dist` já está instalado; usar `pdfDoc.getPage(n).getTextContent()` para extrair texto de todas as páginas
- A Edge Function usa tool calling do Lovable AI para retorno estruturado (não pede JSON direto)
- Matching de cliente: busca por CNPJ no campo `clients.document` (removendo formatação)
- Matching de tipo: comparação por nome entre o retorno da IA e `document_types.name`
- `extraction_config` com regiões visuais será enviado como contexto adicional para a IA saber onde olhar
- Nenhuma migração necessária

