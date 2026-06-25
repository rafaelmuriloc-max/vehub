## Objetivo
Permitir que a barra de pesquisa de conversas no chat filtre por **nome**, **telefone** e **empresa**.

## Contexto atual
No arquivo `src/components/chat/ConversationList.tsx`, o filtro de busca (linhas 119-124) já considera:
- `c.name` (nome da conversa/contato)
- `c.companyNames` (empresas vinculadas)

Mas **não busca por `whatsappPhone`**, apesar de o campo existir na interface `ConversationItem`.

## Alteração
No `ConversationList.tsx`, estender a função `filtered` para também verificar se o termo de busca está contido em `c.whatsappPhone` (após remover caracteres não numéricos, permitindo busca parcial por dígitos).

### Detalhes técnicos
- Normalizar o termo de busca removendo não-dígitos.
- Comparar com os últimos dígitos do telefone, similar ao padrão já usado em outros componentes do chat (ex.: `ForwardMessageDialog.tsx`).
- Atualizar o `placeholder` do input para refletir os novos critérios de busca.

## Arquivos afetados
- `src/components/chat/ConversationList.tsx`
