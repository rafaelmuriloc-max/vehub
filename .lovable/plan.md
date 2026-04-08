

# Adicionar campo "Anexo do Simples Nacional" na aba Fiscal

## Contexto
Quando o regime tributário do cliente é "Simples Nacional", é necessário informar em qual Anexo (I a V) a empresa se enquadra. Esse campo deve aparecer condicionalmente e ser preenchido automaticamente por IA com base no CNAE principal, além de permitir edição manual.

## Solução

### 1. Migração de banco de dados
Adicionar coluna `simples_anexo` na tabela `clients`:
```sql
ALTER TABLE public.clients ADD COLUMN simples_anexo text;
```

### 2. `src/pages/Clients.tsx`

**a) Form state** — Adicionar `simples_anexo: ''` ao `emptyForm` e ao tipo `Client`.

**b) Load/Save** — Incluir `simples_anexo` no payload de save e na leitura ao editar um cliente.

**c) UI condicional** — Após o `Select` de Regime Tributário, renderizar condicionalmente (quando `form.tax_regime === 'simples_nacional'`) um `Select` com as opções:
- Anexo I (Comércio)
- Anexo II (Indústria)
- Anexo III (Serviços)
- Anexo IV (Serviços)
- Anexo V (Serviços)

**d) Auto-preenchimento por IA** — Criar função `classifyAnexoByAI(mainCnae)` que chama uma edge function para determinar o anexo correto com base no CNAE. Disparar quando:
- O regime for alterado para `simples_nacional` e já houver CNAE preenchido
- O CNAE principal for alterado e o regime já for `simples_nacional`

### 3. `supabase/functions/classify-segment/index.ts`
Adicionar suporte a um novo campo `classify_anexo: true` no body. Quando presente, o prompt da IA será:
> "Com base no CNAE {cnae}, determine em qual Anexo do Simples Nacional (I, II, III, IV ou V) essa atividade se enquadra. Responda apenas com o número romano."

Retornará `{ anexo: "III" }` (por exemplo).

## Arquivos alterados
- **Migração SQL** — 1 coluna nova em `clients`
- **`src/pages/Clients.tsx`** — ~30 linhas (form state, UI condicional, auto-classificação)
- **`supabase/functions/classify-segment/index.ts`** — ~15 linhas (novo modo `classify_anexo`)

