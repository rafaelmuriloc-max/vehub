## Botão de ligação no Chat (Evolution API)

### Limitação importante
A Evolution API só consegue **fazer o WhatsApp do cliente tocar** (chamada de voz ou vídeo). Ela **não transmite áudio**: ninguém fala nem ouve pelo sistema. Quando o cliente atende, a chamada não tem som e encerra sozinha depois do tempo definido. Serve como "toque de aviso" para chamar a atenção do cliente. Para conversar de verdade, é preciso ligar pelo celular/WhatsApp do escritório.

### O que será feito
1. No topo da conversa (ao lado do nome/telefone), um botão com ícone de telefone, visível só em conversas individuais de WhatsApp (escondido em grupos e conversas sem telefone).
2. Ao clicar, abre uma pequena janela: escolher **Voz** ou **Vídeo**, com o aviso da limitação acima, e botão "Ligar".
3. O WhatsApp do cliente toca por cerca de 20 segundos. Aparece aviso de sucesso ou o motivo do erro (instância desconectada, número sem WhatsApp).
4. Fica registrado na conversa uma mensagem interna "Ligação de voz feita por {atendente}" (não enviada ao cliente).

### Detalhes técnicos
- Nova função `evolution-call`: valida o usuário, recebe `conversationId` e `isVideo`, busca `whatsapp_phone` da conversa, resolve o número com `/chat/whatsappNumbers/{instance}` e chama `POST /call/offer/{instance}` com `{ number, isVideo, callDuration: 20 }`, usando os secrets Evolution já existentes. Erros retornam status e corpo da Evolution.
- `MessageArea.tsx`: botão + diálogo; `Chat.tsx`: handler `onCall` invocando a função e gravando o registro em `chat_messages` como nota de sistema.
- Sem mudança no banco.
