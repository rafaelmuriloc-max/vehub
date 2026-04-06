

# Vinculação de documentos baseada em modelos configurados

## Problema atual
Toda importação de documento usa a IA (Edge Function `classify-document`) para identificar CNPJ, empresa, competência e tipo. Isso consome créditos de IA mesmo quando os tipos de documento já possuem regiões de extração configuradas (`extraction_config`).

## Solução proposta
Inverter a prioridade: primeiro tentar extrair dados usando as regiões configuradas nos modelos de documento (client-side, sem IA), e só recorrer à IA como fallback quando a extração por regiões falhar.

## Fluxo novo de importação

```text
PDF enviado
    │
    ▼
Extrair texto completo (pdfjs)
    │
    ▼
Para cada document_type com extraction_config:
  → Extrair texto das regiões configuradas (CNPJ, competência, etc.)
  → Tentar match de CNPJ com clientes cadastrados
  → Se CNPJ bateu → documento identificado ✓
    │
    ├─ Match encontrado → Importar automaticamente
    │
    └─ Nenhum match → Fallback: chamar IA (modelo gratuito)
                        → Revisão manual se necessário
```

## Alterações

### 1. Função de extração por regiões no client-side (`src/pages/Documents.tsx`)

Nova função `extractByRegions(pdf, documentTypes)` que:
- Carrega os `document_types` com `extraction_config` do banco
- Para cada tipo que tem regiões configuradas, extrai o texto da área demarcada usando `pdfjs` (getTextContent + filtragem por coordenadas percentuais)
- Aplica regex para extrair CNPJ (14 dígitos) e competência (MM/YYYY, YYYY-MM, etc.)
- Retorna o primeiro match válido (tipo + CNPJ + competência)

A extração por coordenadas funciona assim: `pdfjs` retorna itens de texto com posição (x, y, width, height). Comparamos cada item com a região configurada (convertida de % para pixels) e concatenamos apenas o texto dentro da área.

### 2. Alterar o fluxo de upload em `handleUpload`

```text
1. Extrair texto completo do PDF (já existe)
2. NOVO: Tentar extractByRegions() com os document_types configurados
3. Se encontrou match → importar direto (sem IA)
4. Se não encontrou → chamar classify-document (fallback IA)
5. Revisão manual para os que falharam em ambos
```

### 3. Atualizar Edge Function para usar modelo gratuito

Em `supabase/functions/classify-document/index.ts`, trocar o modelo de `google/gemini-3-flash-preview` para `google/gemini-2.5-flash-lite` (o mais leve e econômico disponível no gateway Lovable AI, incluído no plano gratuito).

### 4. Carregar extraction_config na query de document_types

Atualizar a query em `loadAll()` para incluir `extraction_config` no select dos `document_types`, permitindo o uso das regiões no client-side.

## Arquivos alterados
- `src/pages/Documents.tsx` — nova lógica de extração por regiões + fluxo condicional (~60 linhas)
- `supabase/functions/classify-document/index.ts` — trocar modelo para `gemini-2.5-flash-lite`

## Benefícios
- Documentos com modelos configurados são importados instantaneamente (sem esperar IA)
- Redução significativa de chamadas à IA (só fallback)
- Menor custo operacional

