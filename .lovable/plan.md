## Causa da duplicação

As atividades de envio (WhatsApp/E-mail) com anexo estão criando 2–3 linhas em `obligation_activity_completions` para o mesmo par `(instance_id, activity_id)` — todas com `file_url = NULL`, `completed = true`, criadas com diferença de 1–10 segundos.

Exemplo real (instância `e6e1913d…`, atividade `031cb5f8…`):

```
12:37:37.299  completed=true  (marker)
12:37:39.467  completed=true  (marker)
12:37:47.069  completed=true  (marker)
```

Outros 6 pares idênticos nos últimos 60 dias.

### Por que acontece

Tanto `src/lib/sendActivityWhatsApp.ts` (função `reconcileActivityCompletion`) quanto `src/lib/sendActivityEmail.ts` e a Edge Function `obligation-activity-reconcile` (cron a cada 10 min) executam o padrão:

```ts
const { data: existing } = await supabase
  .from('obligation_activity_completions')
  .select(...)
  .eq('instance_id', ...).eq('activity_id', ...)
  .maybeSingle();

if (existing) update(...) else insert(...);
```

Esse `SELECT → INSERT` é uma race condition clássica. Quando dois caminhos rodam quase simultaneamente — usuário clica enviar + cron de reconciliação dispara, ou usuário clica duas vezes rápido, ou várias chamadas em paralelo na mesma sessão — ambos veem `existing = null` e ambos fazem `INSERT`. Como não existe restrição única no banco para o par `(instance_id, activity_id)`, os dois INSERTs vencem.

Atividades sem anexo também sofrem disso, mas o problema ficou mais visível em obrigações com documento porque o fluxo do anexo é mais longo (assina URL, envia template, envia cada PDF, depois reconcilia), aumentando a janela de corrida com o cron.

## Correção

### 1. Migration (banco)

a. Deduplicar rows existentes com `file_url IS NULL`: para cada `(instance_id, activity_id)` manter apenas o `completed_at` mais antigo, deletar o resto. (As linhas com `file_url` preenchido representam documentos anexados — não são tocadas.)

b. Criar índice único parcial impedindo nova duplicação do "marker de conclusão":

```sql
CREATE UNIQUE INDEX obligation_activity_completions_unique_marker
  ON public.obligation_activity_completions (instance_id, activity_id)
  WHERE file_url IS NULL;
```

### 2. Código — `src/lib/sendActivityWhatsApp.ts` e `src/lib/sendActivityEmail.ts`

Substituir o `SELECT + INSERT/UPDATE` em `reconcileActivityCompletion` por `upsert` com `onConflict: 'instance_id,activity_id'` (filtrado pelo índice parcial via `ignoreDuplicates: false`). Como `onConflict` parcial não é trivial no PostgREST, a forma segura é:

1. Tentar `INSERT`; se erro `23505` (unique violation), buscar a linha existente pelo par `(instance_id, activity_id) WHERE file_url IS NULL` e fazer `UPDATE` nela.
2. Espelhar o mesmo tratamento na Edge Function `obligation-activity-reconcile`.

### 3. Edge Function — `obligation-activity-reconcile/index.ts`

Aplicar a mesma proteção `23505 → fallback update` nos dois caminhos (`whatsapp` e `email`).

## Arquivos a modificar

- `supabase/migrations/<ts>_dedupe_activity_completions.sql` (novo)
- `src/lib/sendActivityWhatsApp.ts` (função `reconcileActivityCompletion`)
- `src/lib/sendActivityEmail.ts` (bloco de upsert da completion)
- `supabase/functions/obligation-activity-reconcile/index.ts` (4 pontos de insert)

## Verificação após implementar

- Rodar `SELECT instance_id, activity_id, COUNT(*) FROM obligation_activity_completions WHERE file_url IS NULL GROUP BY 1,2 HAVING COUNT(*) > 1;` → deve voltar 0.
- Invocar `obligation-activity-reconcile` manualmente; conferir nos logs que não cria novas linhas em obrigações já concluídas.
