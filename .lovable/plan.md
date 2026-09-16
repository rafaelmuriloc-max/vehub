# Envio dos documentos das tarefas #000434 e #000435

## O que os dados mostram

As duas tarefas foram concluídas hoje (12:11 e 12:12) e têm anexos para o cliente (4 e 2 arquivos). O canal configurado é apenas e-mail, e o registro de envio está vazio nas duas.

Nos registros do servidor, o envio foi tentado nas duas vezes e o Gmail recusou a conexão do Departamento Pessoal com:

```text
535 5.7.8 Username and Password not accepted (BadCredentials)
```

Ou seja: a senha de aplicativo do e-mail do Depto Pessoal está inválida/expirada. Houve a mesma falha às 12:08 com outro usuário, então afeta todos os envios desse departamento, não só essas duas tarefas.

Também vale registrar: o cliente (WR Pavimentação) não tem e-mail no cadastro; o envio usa o e-mail do contato do departamento (contato@wrpavimentacao.com.br), que está preenchido — esse não é o problema.

## O que fazer

1. **Reativar a credencial de e-mail do Depto Pessoal** (Configurações > Departamentos): gerar uma nova senha de aplicativo na conta Google usada pelo departamento e salvá-la. Sem isso nenhum envio por e-mail desse departamento funciona. Essa etapa depende de você, pois só a conta Google pode gerar a senha.
2. **Reenviar as duas tarefas** depois da credencial corrigida, disparando novamente a notificação ao cliente com os anexos já existentes (sem duplicar, pois nada foi enviado).
3. **Deixar a falha visível na tela**: hoje, ao concluir a tarefa pelo card, quando o envio falha a tarefa vai para "Concluído" mesmo assim e o aviso passa despercebido. Passar a mostrar um alerta claro ("documentos não enviados: credencial de e-mail recusada") e marcar o card com um indicador de "envio pendente" enquanto o registro de envio estiver vazio, com botão para reenviar.

## Detalhes técnicos

- Causa confirmada em `smtp-send`: erro 535 do Gmail nas três tentativas de hoje; `task-notify-client` executou normalmente e por isso não gravou `notify_sent_at` (nenhum canal com sucesso).
- Ajustes de interface em `src/pages/Tasks.tsx`: em `moveTask`, tratar `result.email.ok === false` mostrando o erro retornado; badge "Envio pendente" nos cards concluídos com `notify_sent_at` nulo e `notify_whatsapp`/`notify_email` ativos, com ação que reinvoca `task-notify-client`.
- Sem alterações de banco, RLS ou edge functions.
