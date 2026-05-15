## Objetivo

Quando uma mensagem é encaminhada via diálogo "Encaminhar mensagem", a nova mensagem entregue ao destinatário deve exibir o indicador "↪ Encaminhada" em itálico no topo do balão (igual ao WhatsApp da imagem de referência), tanto no nosso chat quanto no WhatsApp do contato.

## Mudanças

### 1. Banco de dados (migração nova)
- Adicionar coluna `is_forwarded boolean not null default false` em `chat_messages`.

### 2. `ForwardMessageDialog.tsx`
- No insert direto (conversa interna sem WhatsApp): incluir `is_forwarded: true`.
- Nas chamadas a `whatsapp-send-text` e `whatsapp-send-media`: passar `isForwarded: true` no body.

### 3. Edge functions `whatsapp-send-text` e `whatsapp-send-media`
- Aceitar o parâmetro `isForwarded` no body.
- Incluir `is_forwarded: !!isForwarded` no `insert` em `chat_messages`.
- Não há mudança no payload Meta API — o WhatsApp do contato exibirá nativamente como "encaminhada" apenas se o app reconhecer; em nossa UI o indicador ficará garantido pelo flag salvo. (A Meta Cloud API não expõe o atributo `forwarded` no envio de mensagens — esse rótulo do WhatsApp nativo não é controlável via API; a marcação visual fica garantida no nosso chat.)

### 4. `MessageArea.tsx`
- Selecionar `is_forwarded` na query de mensagens.
- Repassar prop `isForwarded` para `<MessageBubble>`.

### 5. `MessageBubble.tsx`
- Nova prop `isForwarded?: boolean`.
- Quando `true` e a mensagem não estiver deletada, renderizar acima do conteúdo (e abaixo do `senderName`):
  ```
  <div class="flex items-center gap-1 mb-1 text-muted-foreground italic text-xs">
    <Forward className="h-3 w-3 -scale-x-100" /> Encaminhada
  </div>
  ```

## Detalhes técnicos

- Reutilizar o ícone `Forward` já importado (`lucide-react`), com `-scale-x-100` para ficar com a seta apontando como na referência.
- Manter cores via tokens semânticos (`text-muted-foreground`).
- O flag `is_forwarded` é apenas exibição; não impacta lógicas de WhatsApp/edição/exclusão existentes.
