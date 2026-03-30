

# Configuração de modelo para extração automática de dados por tipo de documento

## Resumo
Adicionar no cadastro de Tipo de Documento a possibilidade de fazer upload de um arquivo-modelo (sample). Esse arquivo serve como referência para a IA identificar onde estão as informações de CNPJ, Nome da Empresa, Competência e Tipo de Obrigação em documentos desse tipo, permitindo vinculação automática futura.

## Mudanças

### 1. Migração SQL — novas colunas na tabela `document_types`
```sql
ALTER TABLE document_types
  ADD COLUMN sample_file_url text,
  ADD COLUMN sample_file_name text,
  ADD COLUMN extraction_config jsonb DEFAULT '{}';
```
- `sample_file_url`: caminho do arquivo-modelo no Storage
- `sample_file_name`: nome original do arquivo para exibição
- `extraction_config`: JSON com instruções de extração (campos: cnpj, company_name, reference_month, obligation_type) — pode ser preenchido manualmente ou futuramente por IA

### 2. `src/components/settings/DocumentTypesTab.tsx` — upload do arquivo-modelo no dialog
- Adicionar campo de upload de arquivo no formulário de criação/edição
- Exibir nome do arquivo já enviado com botão para remover
- Adicionar campos de texto para descrever onde cada informação se encontra no documento:
  - "Localização do CNPJ" (ex: "canto superior esquerdo", "linha 3")
  - "Localização do Nome da Empresa"
  - "Localização da Competência"
  - "Localização do Tipo de Obrigação"
- Upload vai para o bucket `documents` com path `document-types/{id}/sample.ext`
- Na tabela, mostrar ícone indicando se o tipo possui arquivo-modelo configurado

### 3. Nenhuma nova página ou Edge Function necessária
- O arquivo e as configurações ficam armazenados para uso futuro por uma IA de extração
- A estrutura `extraction_config` será consumida quando a funcionalidade de extração automática por IA for implementada

## Detalhes técnicos
- Bucket utilizado: `documents` (já existente, privado)
- Path do sample: `document-types/{document_type_id}/{filename}`
- O `extraction_config` JSON terá a estrutura:
  ```json
  {
    "cnpj_location": "texto descritivo",
    "company_name_location": "texto descritivo",
    "reference_month_location": "texto descritivo",
    "obligation_type_location": "texto descritivo"
  }
  ```
- Arquivos modificados: migração SQL, `DocumentTypesTab.tsx`
- Interface do tipo atualizada para refletir novos campos

