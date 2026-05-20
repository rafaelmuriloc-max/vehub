## Subpastas na Caixa de entrada

Adicionar duas subpastas dentro de "Caixa de entrada", filtrando pelos destinatários `fiscal.velocita@gmail.com` e `pessoal.velocita@gmail.com`.

### Comportamento
- **Caixa de entrada** (raiz) → mostra apenas e-mails que **não** são endereçados a `fiscal.velocita@gmail.com` nem `pessoal.velocita@gmail.com` (em `to_emails` ou `cc_emails`).
- **Fiscal** → e-mails cujo `to_emails`/`cc_emails` contenha `fiscal.velocita@gmail.com`.
- **Pessoal** → e-mails cujo `to_emails`/`cc_emails` contenha `pessoal.velocita@gmail.com`.
- Cada subpasta exibe seu próprio contador de não lidos; o contador da inbox raiz também exclui os e-mails que pertencem às subpastas.
- Subpastas aparecem indentadas abaixo de "Caixa de entrada" na sidebar.

### Implementação
- Apenas frontend, em `src/pages/Email.tsx`.
- Estender `Folder` com `inbox_fiscal` e `inbox_pessoal`.
- Em `load()`:
  - `inbox` → adicionar filtro `.not('to_emails', 'cs', '{fiscal.velocita@gmail.com}')` e idem para pessoal (e o mesmo em `cc_emails`).
  - `inbox_fiscal` / `inbox_pessoal` → `.or('to_emails.cs.{email},cc_emails.cs.{email}')`.
- `loadUnread()` passa a calcular 3 contadores (inbox, fiscal, pessoal) com os mesmos filtros.
- Renderizar as duas subpastas com ícone (`Tag`) indentadas, mantendo estilo atual.

### Sem mudanças
- Sem migration, sem edge function, sem aplicação de labels reais no Gmail (apenas filtro visual no app).