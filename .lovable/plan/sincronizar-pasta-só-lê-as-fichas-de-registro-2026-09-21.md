# "Sincronizar pasta" só lê as fichas de registro

Hoje o botão "Sincronizar pasta" lê todos os arquivos da pasta do Drive, inclusive o relatório de previsão de contrato de experiência e planilhas soltas — e foi isso que gerou registros indevidos. O botão deve tratar apenas o relatório de fichas de registro de colaboradores.

## O que muda

- **Sincronizar pasta**: processa somente arquivos de ficha de registro, reconhecidos pelo nome contendo "registrocolaborador" / "registro de colaborador" (com ou sem acento, maiúsculas ou separadores), nos formatos PDF, HTML/HTM e planilha exportada. Todos os outros arquivos da pasta são simplesmente ignorados, sem gerar erro nem itens pendentes.
- **Sincronizar experiência**: continua lendo apenas o relatório de previsão de contrato de experiência, como já faz.
- Nenhum cadastro existente é alterado ou excluído por essa mudança.
- O resumo ao fim da sincronização passa a informar quantos arquivos foram ignorados por não serem ficha de registro.

## Detalhes técnicos

- `supabase/functions/employee-folder-sync/index.ts`:
  - Criar `isRegistrationFileName(name)` ao lado de `isTrialFileName` (linha ~505): normaliza o nome (NFD, minúsculas, remove não alfanuméricos) e exige a presença de `registrocolaborador`, com extensão `.pdf`, `.htm(l)`, `.xls(x)` ou `.csv`.
  - No laço de arquivos (linha ~572): quando não for `onlyTrial`, pular arquivos que não passem em `isRegistrationFileName`, contando em um novo `stats.fora_do_padrao` — sem gravar em `employee_documents`.
  - Manter o comportamento atual de `onlyTrial`.
- Sem alteração de banco nem de tela (o resumo já exibe as estatísticas retornadas).
- Validação: `bunx tsgo --noEmit`, `deno test -A` na função, build e redeploy de `employee-folder-sync`.
