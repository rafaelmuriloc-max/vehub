## Problema

O erro `new row violates row-level security policy` ao importar documentos é causado pela política RLS da tabela `public.documents`, que hoje permite `INSERT`/`UPDATE`/`DELETE` apenas para usuários com papel `admin`. Funcionários (papel `employee`), que são quem mais importa documentos no dia a dia, ficam bloqueados.

Políticas atuais:
- INSERT: `has_role(auth.uid(), 'admin')`
- UPDATE: `has_role(auth.uid(), 'admin')`
- DELETE: `has_role(auth.uid(), 'admin')`
- SELECT: todos autenticados

Storage do bucket `documents` já permite upload para qualquer autenticado — então o upload do arquivo funciona, mas o `INSERT` na tabela falha logo em seguida (foi isso que apareceu no toast do print).

## Correção

Migration ajustando as políticas da tabela `public.documents`:

1. **INSERT** — permitir qualquer usuário autenticado, exigindo apenas que `uploaded_by = auth.uid()` (garante rastreabilidade).
2. **UPDATE** — permitir admin OU o próprio `uploaded_by` (necessário para o passo de vinculação que grava `linked_obligation_id` logo após o insert).
3. **DELETE** — manter restrito a admin.
4. **SELECT** — manter como está.

Isso libera tanto o fluxo novo (`ImportSetupDialog` → `importDocument`) quanto a re-vinculação subsequente, sem afetar a leitura nem abrir exclusão para não-admins.

## Out of scope

- Não mexer no bucket de Storage (já está OK).
- Não alterar lógica de `importDocument` / `ImportSetupDialog` — o código está correto, só falta permissão.
- Não alterar políticas de outras tabelas.