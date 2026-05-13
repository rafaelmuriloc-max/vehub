## Objetivo
Estilizar mensagens de **áudio** e **documento** no chat para imitar o visual do WhatsApp mostrado no screenshot.

## Áudio — novo componente `src/components/chat/AudioMessage.tsx`

Player customizado dentro da bolha:

```
[avatar redondo com mic badge]  [▶/⏸]  ▮▮▮·▮▮▮·▮▮▮▮▮▮▮  0:04
```

- Botão play/pause à esquerda (triângulo / pause), 28px, cor do tema (emerald/zinc).
- "Waveform" estática gerada por seed do `mediaUrl` (~40 barras finas com alturas pseudo-aleatórias). A parte já reproduzida fica colorida (primary), o restante muted. Um ponto colorido (4px) marca a posição atual.
- Tempo abaixo do waveform: enquanto parado mostra duração total; durante reprodução mostra tempo decorrido.
- Avatar circular (40px) com pequeno badge de microfone laranja no canto inferior.
  - Para mensagens recebidas (`!showOnRight`): avatar do contato (`avatarUrl`).
  - Para enviadas (`showOnRight`): avatar do remetente (passar `senderAvatarUrl`); fallback para iniciais.
- Áudio HTML5 oculto (`<audio>` com ref) controla play/pause, `timeupdate` e `loadedmetadata`.
- Sem texto adicional na bolha (já era o caso).

Props: `mediaUrl`, `avatarUrl?`, `tint` ('green' | 'white').

## Documento — refatorar branch `whatsapp_document` em `MessageBubble.tsx`

Layout estilo WhatsApp:

```
[PDF/DOC/XLS badge]  Nome do arquivo (até 2 linhas, bold)
                     185 KB · pdf
```

- Badge à esquerda, 44x44, cor por extensão:
  - pdf → vermelho
  - doc/docx → azul
  - xls/xlsx → verde
  - default → cinza
  - Texto da extensão (uppercase) dentro do badge.
- Título: nome do arquivo, `font-medium`, `line-clamp-2`, sem cor primary (igual ao screenshot — preto).
- Subtítulo: `tamanho · extensão`. Tamanho calculado via `HEAD` request (`Content-Length`) ao montar; enquanto carrega exibe só `extensão`.
- Click → mantém download via blob (lógica atual).
- Bolha mantém estilo padrão (verde para enviados / branco para recebidos).

## Integração

- `MessageBubble.tsx`:
  - `case 'whatsapp_audio'` passa a renderizar `<AudioMessage mediaUrl={...} avatarUrl={...} tint={showOnRight ? 'green' : 'white'} />` no lugar do `<audio controls>`.
  - `case 'whatsapp_document'` passa a renderizar o novo layout descrito acima.
  - Ajustar a bolha de áudio para padding menor (a "bolha" do screenshot é praticamente o próprio player).
- `MessageArea.tsx`: passar `avatarUrl` do contato para `MessageBubble` quando o tipo for áudio (já existe a prop).

## Não muda
- Backend, banco, RLS, lógica de envio.
- Imagem, vídeo, localização, contato — permanecem como estão.
