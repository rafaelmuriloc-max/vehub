# Enviar DAS MEI pelo WhatsApp com mensagem antes

## O que muda
Na aba Fiscal > MEI > Guias e Pagamentos:

**Geração em lote**
- Na janela de confirmação do lote, nova opção **"Enviar pelo WhatsApp para cada empresa"** (ligada por padrão) e uma caixa com o texto da mensagem, editável.
- Texto padrão: "Olá! Segue a guia DAS do MEI da empresa {empresa}, competência {competencia}, com vencimento em 20/{mes seguinte}. Qualquer dúvida, estamos à disposição."
  - {empresa} e {competencia} são trocados automaticamente para cada empresa.
- Para cada empresa: gera a guia, manda a mensagem e logo depois o PDF, na mesma conversa.
- Para quem enviar: o mesmo critério já usado nos parcelamentos — primeiro a conversa existente da empresa no Chat, depois contato principal, contatos dos departamentos e telefone da empresa. Se não houver conversa, ela é criada ligada à empresa e a quem enviou.
- Empresa sem telefone cadastrado: a guia vai só para o ZIP e aparece na lista como "Sem telefone — não enviada".
- O ZIP continua sendo baixado no final.
- Resumo final: geradas, enviadas e falhas (com o motivo).

**Por empresa**
- Novo botão **"Enviar DAS"** em cada linha: gera a guia e abre a janela de revisão (escolher o telefone, editar o texto) antes de enviar — igual aos parcelamentos.

## Cuidados
- Mensagens só vão para os contatos da empresa, nunca para grupos internos.
- O envio usa o mesmo WhatsApp do Chat, e tudo fica registrado na conversa.
- Pausa entre envios para não ser bloqueado pelo WhatsApp.

## Detalhes técnicos
- Extrair de `RfbParcelamentos.tsx` para `src/lib/sendGuiaWhatsApp.ts`: busca de telefones (`chat_conversations`, `clients`, `client_department_contacts`), `ensureConversation`, upload em `chat-media` e envio via `whatsapp-send-text` + `whatsapp-send-media`. Parcelamentos passam a usar o mesmo módulo, sem mudança de comportamento.
- `MeiTab.tsx`: opção e texto no diálogo do lote; envio após cada PDF (pausa ~1,5 s); botão e diálogo de revisão por empresa.
- Teste para a troca de {empresa}/{competencia} e para a ordem de escolha do telefone.
- Sem mudanças no banco nem nas funções do servidor.
