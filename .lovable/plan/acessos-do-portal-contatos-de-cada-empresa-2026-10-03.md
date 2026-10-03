# Acessos do portal = contatos de cada empresa

## Como vai funcionar
- Os acessos da Área do Cliente passam a vir do cadastro de cada empresa: o contato principal e os contatos de cada departamento.
- Cada pessoa é identificada pelo **e-mail**. Se o mesmo e-mail é contato de várias empresas, a pessoa recebe **um único login** e vê todas essas empresas no seletor do portal.
- Contato sem e-mail não pode ter acesso. Ele aparece marcado como "sem e-mail" para o escritório completar o cadastro.
- E-mails do próprio escritório (@velocitacontabilidade.com.br) são ignorados e nunca viram acesso de cliente.

## Tela "Acessos de Clientes" (Meu Escritório)
- Deixa de ter o cadastro manual com escolha de empresas. Passa a mostrar a lista de contatos, juntando cada pessoa pelo e-mail, com:
  - nome, e-mail, WhatsApp e as empresas onde a pessoa é contato;
  - situação: "Sem acesso", "Senha temporária" ou "Ativo".
- Ações em cada linha: **Liberar acesso** (cria o login, gera a senha temporária e envia pelo WhatsApp do contato), **Reenviar senha** e **Bloquear acesso**.
- Busca por nome, e-mail ou empresa, e filtro por situação.
- Não cria logins automaticamente para todos: o escritório libera quem quiser.

## Mantendo sincronizado com o cadastro
- Quando você incluir o mesmo e-mail como contato em outra empresa, essa empresa aparece automaticamente para quem já tem acesso.
- Quando você remover o contato, ou trocar o e-mail dele, a empresa some do portal dessa pessoa na hora.
- Se a pessoa deixar de ser contato de todas as empresas, o portal mostra "Nenhuma empresa vinculada" até você bloquear o acesso.

## Números atuais (consultados no banco)
- 1.152 contatos de departamento, 1.051 com e-mail, que dão 152 e-mails diferentes, além dos contatos principais das empresas.
- O e-mail do escritório aparece como contato em 14 empresas. Por isso ele será ignorado.

## Detalhes técnicos
- Os vínculos (`client_portal_links`) passam a ser calculados, deixam de ser cadastrados à mão. Nova função segura `portal_can_access_client(user, client)` que confere se o e-mail do usuário logado (pelo login) aparece em `clients.contact_email` ou em `client_department_contacts.contact_email` daquela empresa, ignorando maiúsculas e espaços. A regra de segurança "Portal client guard" continua igual e passa a usar essa função.
- Uma view, ou consulta somente para admins, junta os contatos por e-mail e mostra a situação de cada um (se já existe login com papel `client`).
- `manage-user`: ação `create` com papel `client` passa a receber só o e-mail do contato. Ela recusa e-mails do escritório e e-mails que já são de funcionário, e não grava mais vínculos manuais.
- A tabela `client_portal_links` fica sem uso. Ela será removida numa migração depois que tudo estiver validado.
- Testes: juntar contatos pelo e-mail sem diferenciar maiúsculas, excluir o domínio do escritório, e acesso liberado ou negado por empresa.
- Continua pendente publicar as funções `manage-user` e `integra-contador`, que depende da sua autorização.
