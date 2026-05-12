## Problema

Ao anexar `162_042026_ELITE MONTAGEM DE ESTRUTURA METALICA LTDA_Recibo de salário.pdf` na atividade "Recibos" da Folha de Pagamento, o Supabase Storage rejeita com `Invalid key`.

Causa: o arquivo contém **espaços** e o caractere acentuado **á** (em "salário"). Em `src/pages/CalendarView.tsx:392` o path é montado direto com `file.name`, sem sanitização — violando a regra do projeto ("Always sanitize storage keys: replace spaces/accents with underscores, NFD normalization").

## Mudança

**`src/lib/utils.ts`** — adicionar utilitário `sanitizeStorageName(name: string)`:
- Separa basename + extensão
- Aplica `.normalize('NFD').replace(/[\u0300-\u036f]/g, '')` para remover acentos
- Substitui qualquer caractere que não seja `[A-Za-z0-9._-]` por `_`
- Colapsa underscores repetidos
- Reconstroi `basename.ext`

**`src/pages/CalendarView.tsx`** (linha 392) — usar o utilitário:
```ts
const safeName = sanitizeStorageName(file.name);
const path = `obligations/${detailInstanceId}/${activityId}/${safeName}`;
```

## Fora de escopo

- Outros pontos de upload do app já existentes (não foi reportado problema lá).
- Renomeação de arquivos antigos já no bucket.
