# Remover a seção "Já vencidos" da janela de experiências

## Contexto
Na página Pessoal, ao clicar no card **Experiências a vencer em 15 dias**, abre uma janela que mostra os funcionários a vencer e, abaixo, uma seção vermelha "Já vencidos". O usuário não quer mais a seção de vencidos nessa janela.

## Mudança (arquivo único: `src/pages/Personnel.tsx`)
- Remover o bloco `{trialAlerts.overdue.length > 0 && (...)}` (linhas 895–929) — a seção "Já vencidos" inteira, com os grupos vermelhos por empresa.
- Todo o resto permanece igual: o card continua mostrando o contador de vencidos ("X prazo(s) já vencido(s)") e a janela continua mostrando apenas os funcionários a vencer nos próximos 15 dias, agrupados por empresa.

## Validação
- `bunx tsgo --noEmit` e build.
- Conferir no preview que a janela abre sem a seção "Já vencidos".
