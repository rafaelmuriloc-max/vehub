# Chamados sem empresa informada

## O que foi verificado

Dos chamados atuais, 10 estão sem empresa. Em todos eles a conversa do chat também está sem empresa vinculada (`client_id` nulo) — o chamado apenas copia o que a conversa tem, então a falha está na vinculação da conversa.

Buscando pelo telefone do contato nos cadastros:

- 5 telefones batem com exatamente 1 empresa (via contatos por departamento): Fábio, Polaco, Tiago, Andrieli/Drika, Bianca.
- 4 telefones não estão em nenhum cadastro (Cobrança, CDL Penha, Rebecca, Dorothea) — esses continuarão sem empresa até serem cadastrados.

## O que será feito

1. **Resolver empresa pelo telefone**: quando a conversa não tiver empresa, o chamado passa a buscar o telefone (somente dígitos, tolerando o 9º dígito) em:
   - contato principal do cliente (`clients.contact_phone`);
   - contatos por departamento (`client_department_contacts.contact_phone`).
   Só vincula quando o telefone aponta para uma única empresa; se houver ambiguidade, fica em branco (sem chute).
2. **Manter sincronizado**: se a conversa for vinculada a uma empresa depois (registro do contato no chat), o chamado aberto correspondente passa a refletir essa empresa.
3. **Corrigir os registros existentes**: aplicar a mesma resolução aos chamados já criados que estão sem empresa (resolve 5 dos 10 casos atuais) e também gravar a empresa na conversa do chat correspondente, que hoje segue sem vínculo mesmo com o contato já cadastrado.
4. **Lista de chamados**: quando não houver empresa, mostrar "Não cadastrado" em vez de apenas um traço, para diferenciar de dado ausente.

## Detalhes técnicos

- Função `public.resolve_client_by_phone(_phone text)` (SECURITY DEFINER, STABLE): normaliza para dígitos, gera as variantes com/sem o 9º dígito, procura em `clients.contact_phone` e `client_department_contacts.contact_phone`, retorna o `client_id` somente se houver 1 resultado distinto.
- `trg_ticket_open_on_conversation` e `trg_ticket_sync_on_conversation` passam a usar `coalesce(NEW.client_id, public.resolve_client_by_phone(NEW.whatsapp_phone))`; o sync também atualiza `client_id` do chamado aberto quando a conversa ganha empresa.
- Backfill (`UPDATE support_tickets` e `UPDATE chat_conversations`) usando a mesma função para os registros com `client_id is null`.
- `src/pages/Tickets.tsx`: rótulo "Não cadastrado" na coluna Empresa e no dialog de detalhe quando `client_id` for nulo.
