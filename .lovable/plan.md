## Corrigir aba bloqueada ao abrir anexo

**Causa:** `window.open(blobUrl)` é chamado depois de `await fetch(...)`, então o navegador perde o gesto do usuário e bloqueia o pop-up.

### Frontend — `src/pages/Email.tsx` (`downloadAttachment`)
- Abrir a aba **antes** de qualquer `await`: `const win = window.open('about:blank', '_blank')`.
- Escrever um "Carregando..." no `win.document` para feedback.
- Após obter o blob, fazer `win.location.replace(blobUrl)`.
- Se `win` for `null` (pop-up bloqueado pelo usuário), fallback: criar `<a href={blobUrl} download={filename}>`, anexar ao DOM, `.click()` e remover — força download direto.
- Manter `URL.revokeObjectURL(blobUrl)` após ~60s.

### Sem mudanças
- Edge function `gmail-attachment` permanece como está (já serve bytes).