# Enviar guia de parcelamento para o contato cadastrado da empresa

## Por que acontece
Hoje o botão "Enviar via WhatsApp" só procura uma **conversa já existente no Chat** ligada à empresa. Ele não olha os telefones do cadastro da empresa. Por isso, a JR FOOD SERVICE (e outras) aparecem como "sem WhatsApp" mesmo tendo um contato cadastrado.

## O que muda
- Ao abrir a janela de envio, o sistema procura nesta ordem:
  1. Conversa individual no Chat já ligada à empresa.
  2. Telefone de contato do cadastro da empresa.
  3. Contatos dos departamentos da empresa.
  4. Telefone geral da empresa.
- Na janela aparece uma lista com os números encontrados (nome do contato + telefone), já marcando o primeiro. Você pode trocar o número antes de enviar.
- Se o número escolhido ainda não tiver conversa no Chat, ela é criada na hora (ligada à empresa e a você), do mesmo jeito que o botão "Nova conversa" do Chat. Se já existir conversa com esse número, ela é reaproveitada.
- O aviso vermelho só aparece quando a empresa realmente não tem nenhum telefone cadastrado.
- A mensagem e o PDF continuam ficando registrados na conversa da empresa.

## Detalhes técnicos
- Arquivo: `src/components/integra-contador/RfbParcelamentos.tsx` (`openSend`, `confirmSend` e a janela de envio).
- Fontes: `chat_conversations` (com `client_id`, sem grupo), `clients.contact_phone` / `contact_name` / `phone`, `client_department_contacts.contact_phone` / `contact_name`.
- Telefones ficam sem duplicatas (usando `canonicalizePhone`/`phoneVariants`, os mesmos de `NewConversationDialog`).
- O `sendState` passa a guardar `options: {label, phone, conversationId|null}[]` e `selected`.
- No `confirmSend`, quando falta `conversationId`, a conversa é procurada pelas variantes do telefone; se não existir, cria em `chat_conversations` com `client_id`, `assigned_to` e `created_by` iguais ao usuário atual e `is_group=false`, e insere o usuário em `chat_participants`. Depois envia texto e mídia como hoje.
- O banco e as funções do servidor não mudam.
