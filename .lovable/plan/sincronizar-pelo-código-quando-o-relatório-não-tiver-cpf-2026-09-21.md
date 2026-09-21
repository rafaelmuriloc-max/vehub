# Sincronizar pelo código quando o relatório não tiver CPF

Hoje, quando o relatório não traz CPF, a sincronização procura a pessoa apenas pelo nome. Relatórios como o de contrato de experiência trazem o código do colaborador, que é mais confiável que o nome.

## O que muda

Ao identificar cada pessoa do relatório dentro da empresa, a busca passa a seguir esta ordem:

1. CPF, quando o relatório tiver.
2. Código do funcionário, quando não houver CPF (comparando sem zeros à esquerda, para "007" casar com "7").
3. Nome, como último recurso (sem acentos e sem diferença de maiúsculas), igual hoje.

Efeitos práticos:

- Pessoas com nome grafado de forma diferente entre relatórios deixam de ser duplicadas quando o código bate.
- Quem tiver código só é considerado a mesma pessoa se o código for igual — evita casar homônimos errados.
- Cadastro novo continua sendo criado quando nada casar; as regras atuais de atualização (rescisão, prazos de experiência e preenchimento de código vazio) ficam iguais.
- Quando duas linhas do mesmo arquivo forem da mesma pessoa, elas também passam a ser agrupadas pelo código, não só pelo nome.

## Detalhes técnicos

- `supabase/functions/employee-folder-sync/index.ts`:
  - No bloco de casamento (linhas ~836-850): após a busca por CPF, adicionar busca por `employee_code` dentro do `client_id`, comparando os códigos normalizados (`replace(/^0+/, "")`, trim, maiúsculas); manter a busca por nome depois.
  - Na deduplicação do extrator (linha ~452): chave `cpf:` → `cod:` → `nome:`.
- Sem alteração de banco nem de tela.
- Validação: `bunx tsgo --noEmit`, `deno test -A` na função, build, e redeploy de `employee-folder-sync`.
