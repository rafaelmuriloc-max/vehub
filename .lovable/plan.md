

# Enviar e-mail com nome do remetente (usuário logado)

## Resumo
Ao enviar um e-mail, o campo `from` do SMTP passará a incluir o nome do usuário logado, no formato `"Nome do Usuário" <email@departamento.com>`.

## Mudanças

### 1. Edge Function `smtp-send` — aceitar `senderName`
- Aceitar campo opcional `senderName` no body da requisição
- Alterar `sendOptions.from` de `dept.smtp_email` para `"${senderName}" <${dept.smtp_email}>` quando `senderName` for fornecido

### 2. `src/pages/Email.tsx` — enviar `senderName`
- Usar `profile?.full_name` do `useAuth()` como `senderName` no body da chamada `