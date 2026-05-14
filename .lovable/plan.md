Plano para corrigir o problema sem alterar o fluxo visual:

1. Ajustar o clique em documentos do chat
   - Trocar a abertura direta com `window.open(mediaUrl, ...)` por um fluxo mais robusto: buscar o arquivo como `Blob`, criar uma URL local temporária e abrir/baixar a partir dela.
   - Isso evita que o bloqueador trate o clique como navegação suspeita para URL externa do Supabase quando acionado dentro do app.

2. Manter fallback seguro
   - Se o `fetch` do arquivo falhar por CORS, expiração ou bloqueio, abrir o link original como fallback.
   - Se o popup for bloqueado, forçar download com um `<a download>` temporário.

3. Melhorar compatibilidade com navegador
   - Reaproveitar o nome do arquivo exibido no chat para o download.
   - Remover a necessidade de copiar e colar o link manualmente quando o clique normal for usado.

4. Validação
   - Verificar que o componente afetado é somente o anexo de documento do chat.
   - Confirmar que imagens, vídeos e áudio continuam usando o comportamento atual.