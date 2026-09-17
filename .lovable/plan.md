# Acesso por convite: sem cadastro aberto, senha temporária enviada por WhatsApp

## O que você pediu
- Tirar a opção de criar conta da tela de login.
- Novos usuários só entram se forem previamente cadastrados por um administrador.
- O cadastro chega ao usuário pelo WhatsApp, com o e-mail de acesso e uma senha temporária.
- No primeiro acesso, o sistema obriga a trocar a senha temporária.

## Banco de dados (1 mudança pequena)
- Nova marcação "precisa trocar a senha" no perfil de cada usuário. Ela é ligada quando o admin cria o usuário ou reenvia o acesso, e desligada quando a senha é trocada no primeiro login. Nenhuma tabela nova, nenhum dado existente muda.

## Tela de login
- Remove o "Cadastre-se" — fica só e-mail + senha (e o botão Google segue escondido, para uma etapa futura).
- Quem logar e ainda estiver com senha temporária vai direto para a tela de troca de senha.

## Cadastro de novos usuários (Configurações → Usuários)
- O formulário "Novo Usuário" ganha o campo de WhatsApp e um botão para gerar uma senha temporária forte.
- Ao criar, o sistema envia automaticamente a mensagem de WhatsApp com: e-mail de acesso, senha temporária e o link do sistema, avisando que a senha deve ser trocada no primeiro acesso.
- Cada usuário da lista ganha a ação "Enviar acesso": gera uma senha temporária nova, invalida a antiga e reenvia por WhatsApp (para quem perder a primeira mensagem).
- A lista marca quem ainda não trocou a senha temporária.

## Troca obrigatória no primeiro acesso
- Nova tela "Alterar senha": pede a senha temporária, a nova senha e a confirmação.
- Enquanto a senha não for trocada, todas as telas do sistema ficam bloqueadas e redirecionam para essa tela.
- Após trocar, o usuário entra normalmente.

## Segurança
- A senha temporária é gerada aleatoriamente pelo sistema e visível só uma vez para o admin (no WhatsApp e na confirmação).
- O envio usa a integração WhatsApp já configurada no sistema (Evolution API), pelo número do escritório.
- Nada muda para os 8 usuários atuais: continuam entrando com e-mail e senha como hoje.

## Fora desta etapa (como combinado)
- Login com Google e multi-escritório completos ficam para depois.
