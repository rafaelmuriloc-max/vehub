## Objetivo

Permitir, no diálogo "Nova Conversa", iniciar um chat de WhatsApp digitando um número de telefone que ainda não está cadastrado nem como contato de empresa nem como remetente conhecido.

## Mudanças

Arquivo único: `src/components/chat/NewConversationDialog.tsx`

1. **Detecção do input como telefone**
   - Normalizar o termo de busca removendo caracteres não numéricos.
   - Se o normalizado tiver pelo menos 10 dígitos (DDD + número) e **não corresponder** a nenhum contato já presente em `contacts`, exibir uma linha extra fixa no topo da lista: "Enviar mensagem para +<número digitado>".

2. **Ação ao clicar nessa linha**
   - Reaproveitar `startConversation` passando um `Contact` sintético `{ phone, displayPhone, name: displayPhone, source: 'whatsapp' }`.
   - O fluxo atual já procura conversa existente pelo telefone normalizado e, se não houver, cria nova `chat_conversations` com `whatsapp_phone` preenchido — ou seja, nada novo no backend.

3. **Validação leve**
   - Comprimento entre 10 e 15 dígitos (padrão E.164 sem o "+").
   - Não habilitar a opção quando vazio ou inválido.

4. **UI**
   - Linha com ícone de telefone, label "Enviar mensagem para +<phone>" e subtítulo "Novo contato WhatsApp", no mesmo estilo dos itens existentes.
   - Placeholder do input passa a sugerir: "Buscar por nome, empresa ou digite um telefone...".

Sem mudanças de schema, RLS ou edge functions.
