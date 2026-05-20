## Plano

O bloqueio continua porque o Chrome/extensão está bloqueando a navegação direta para `blob:` em uma nova aba. A requisição do anexo está funcionando (`gmail-attachment` retorna 200 e entrega o PDF), então a correção deve evitar abrir `blob:` diretamente.

### 1. Trocar a estratégia de abertura no frontend
- Em `src/pages/Email.tsx`, alterar `downloadAttachment` para não redirecionar a aba para `blobUrl`.
- Em vez disso, baixar o arquivo como bytes e criar uma página HTML intermediária na aba já aberta.
- Essa página usará um `<iframe>`/`<embed>` apontando para o blob internamente, mantendo a URL da aba como `about:blank`/documento criado, não `blob:`.
- Adicionar botão/estado de fallback para download quando o navegador não conseguir visualizar o arquivo inline.

### 2. Fallback seguro para download
- Se a janela não abrir ou se o tipo de arquivo não for visualizável, acionar download por `<a download>`.
- Manter toast de erro caso a função retorne falha.
- Manter `URL.revokeObjectURL` após tempo suficiente para não invalidar a visualização rapidamente.

### 3. Sem alterações no backend
- Não alterar a Edge Function `gmail-attachment`, pois ela já está retornando corretamente os bytes do anexo.

### Resultado esperado
- Clicar no anexo abre uma aba visualizável sem cair na tela `ERR_BLOCKED_BY_CLIENT`.
- Se o navegador/extensão bloquear a visualização inline, o usuário ainda recebe o arquivo por download.