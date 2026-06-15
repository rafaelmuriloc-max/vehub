# Investigação

Encontrei **duas conversas** do André Locatelli (PORTO PENHA FOOD PARK LTDA), ambas com o mesmo `client_id` e mesma pessoa responsável:

| ID conversa | Telefone armazenado | Criada em | Última msg |
|---|---|---|---|
| `7e57fd9b…` (original) | `5547992839913` (13 dígitos – canônico) | 06/04 | 15/06 14:25 ("Perfeito! Vou transferir…") |
| `8a0b08f2…` (duplicada) | `554792839913` (12 dígitos – sem o "9" de celular) | 03/06 20:05 | 15/06 14:44 ("Cancela.entao") |

## Causa raiz

O cadastro do cliente tem `contact_phone = "(47) 92839913"` (10 dígitos locais, **sem o 9 inicial**). Quando a função `scheduled-messages-runner` disparou uma mensagem automática em 03/06 às 20:05:

1. `pickValidBrazilianWhatsAppPhone` aceita 10 dígitos e devolve `554792839913` sem inserir o "9" do celular.
2. `ensureConversation` faz `eq("whatsapp_phone", normalizedPhone)` (busca exata) em vez de usar variantes — não encontrou a conversa canônica de 13 dígitos e **criou uma nova**.

A partir daí, mensagens enviadas pelo Meta (que normaliza para 13 dígitos) caem na conversa antiga, e mensagens disparadas pelo runner caem na nova → duplicação visível na lista.

Verifiquei o banco e existem ao menos **3 outras duplicatas com o mesmo padrão "12 dígitos vs 13 dígitos"** (DM Processos, Dioser, Porto Penha), além de algumas com telefones realmente diferentes (não são bug).

# Plano

## 1. Corrigir o bug em `supabase/functions/scheduled-messages-runner/index.ts`

- Em `pickValidBrazilianWhatsAppPhone`: quando o DDD for válido e o número tiver 10 dígitos começando por 6-9 no primeiro dígito local, **inserir o "9"** retornando sempre 11 dígitos locais + 55 = 13 dígitos canônicos.
- Em `ensureConversation`: substituir o `eq("whatsapp_phone", normalizedPhone)` por `.in("whatsapp_phone", getPhoneVariants(normalizedPhone))` (replicando o helper de `whatsapp-send` / `whatsapp-webhook`) e, se encontrar variante não-canônica, atualizar para o formato canônico antes de retornar.

## 2. Mesclar as duas conversas do André Locatelli (migração SQL)

Em uma migração one-off:

- `UPDATE chat_messages SET conversation_id = '7e57fd9b…' WHERE conversation_id = '8a0b08f2…'`
- Mover/deduplicar participantes (`chat_participants`) da duplicada para a original.
- `DELETE FROM chat_conversations WHERE id = '8a0b08f2…'`
- `UPDATE chat_conversations SET updated_at = now(), awaiting_first_reply = false, status='open' WHERE id = '7e57fd9b…'` (para refletir a última mensagem "Cancela.entao").
- `UPDATE clients SET contact_phone = '(47) 99283-9913' WHERE id = 'a4b6b030…'` para evitar reincidência.

## 3. (Opcional, recomendado) Limpeza das outras duplicatas com mesmo padrão

Mesma migração detecta pares de conversas do mesmo `client_id` em que um telefone é a versão de 12 dígitos do outro (13 dígitos) e mescla automaticamente — sem tocar nos casos onde os telefones são realmente diferentes.

## Fora do escopo

- Duplicatas com telefones realmente distintos (clientes com 2 números cadastrados) — exigem decisão manual.
- Telefones com lixo (ex: `554738420299000000000000`) — também tratamento manual.

Quer que eu inclua o passo 3 (limpeza em lote dos outros casos do mesmo padrão) ou prefere mesclar só o André Locatelli agora?
