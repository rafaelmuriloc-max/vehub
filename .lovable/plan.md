## Plano

1. **Corrigir envio de áudio gravado/anexado**
   - Ajustar o formato gerado pelo gravador para um tipo aceito pelo WhatsApp.
   - Converter/normalizar o `File` de áudio antes do upload quando necessário, evitando enviar `audio/webm` para a Meta API.
   - Melhorar o tratamento de erro no envio para exibir a mensagem real retornada pela Edge Function.

2. **Corrigir a Edge Function `whatsapp-send-media` para áudio**
   - Para `type: "audio"`, baixar o arquivo público do Storage e converter para `audio/ogg; codecs=opus` antes de chamar a Meta API/Evolution quando o arquivo vier em formato não compatível.
   - Enviar o áudio com MIME/extensão corretos e manter o registro local como `whatsapp_audio` com `sender_id` do usuário atual.
   - Preservar o fallback via Evolution API.

3. **Corrigir balão verde em áudio recebido**
   - Ajustar a regra visual para que `whatsapp_audio` recebido do webhook (`sender_id` do sistema/admin e não do usuário atual) fique à esquerda com balão branco.
   - Manter áudios enviados pelo usuário à direita com o mesmo verde das mensagens de texto.

4. **Corrigir classificação no webhook**
   - Manter áudio recebido como mídia, mas garantir que o frontend não dependa apenas do `message_type` para pintar verde.
   - Se necessário, salvar `whatsapp_incoming` para recebidos com mídia ou ajustar a leitura para inferir recebido por `sender_id`/`currentUserId`.

## Resultado esperado

- Áudio gravado no chat é enviado para o WhatsApp.
- Áudio anexado também é enviado.
- Áudio recebido aparece à esquerda, com balão branco.
- Áudio enviado aparece à direita, com balão verde igual texto.