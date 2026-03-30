

# Seção de Documentos na aba Societário do cadastro de Clientes

## Objetivo
Adicionar uma seção "Documentos Societários" na aba Societário onde o usuário pode anexar Contrato Social e Cartão CNPJ (PDF ou imagem), com upload para Supabase Storage e metadados no banco.

## Mudanças no banco de dados

### Nova tabela `client_society_documents`
```sql
CREATE TABLE public.client_society_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  document_label text NOT NULL, -- 'contrato_social' | 'cartao_cnpj'
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_society_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view" ON public.client_society_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert" ON public.client_society_documents FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete" ON public.client_society_documents FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
```

## Mudanças em `src/pages/Clients.tsx`

### 1. Novo estado para documentos societários
- `societyDocs`: array de `{ id, client_id, document_label, file_name, file_url }`
- `societyUploading`: record de label -> boolean

### 2. Funções de dados
- `loadSocietyDocs(clientId)`: busca documentos do cliente
- `handleSocietyUpload(label, file)`: upload para `documents` bucket no path `{clientId}/societario/{label}/{filename}`, insere registro na tabela
- `handleSocietyDownload(fileUrl)`: cria signed URL e abre
- `handleSocietyDelete(docId, fileUrl)`: remove do storage e da tabela

### 3. UI na aba Societário (após certificado, antes de "Informações dos Sócios")
- Separador visual + título "Documentos Societários"
- Duas seções lado a lado: **Contrato Social** e **Cartão CNPJ**
- Cada seção mostra:
  - Se há arquivo: nome do arquivo + botões download/excluir
  - Se não há: input de upload (aceita `.pdf,.jpg,.jpeg,.png`)
- Em modo viewOnly: apenas mostra arquivo existente com download

### 4. Integração com fluxo existente
- `loadSocietyDocs` chamado em `openEdit` e `openView`
- Documentos limpos ao fechar dialog

## Detalhes técnicos
- Arquivo modificado: `src/pages/Clients.tsx`
- Nova migração SQL para a tabela
- Usa bucket `documents` existente
- Aceita PDF e imagens (`.pdf,.jpg,.jpeg,.png`)

