# Corrigir leitura da planilha com várias empresas

## O que aconteceu (confirmado nos dados)

O arquivo `EMPRESAS_REGISTROCOLABORADOR_092026.csv` contém funcionários de **várias empresas**, mas todos os 31 nomes lidos foram gravados na **JURACY COUTINHO FRANCO JUNIOR LTDA**, que não tem funcionários. Entre eles há sócios e empregados de outras empresas (vidraçaria, pousada, comércio).

Duas falhas somadas:

1. O cabeçalho da planilha não foi reconhecido, então o arquivo foi tratado como texto solto e lido pela leitura automática em 36 partes — sem usar a coluna de empresa de cada linha.
2. Sem empresa por linha, o sistema usou como "empresa do arquivo" o primeiro nome de empresa que apareceu dentro do conteúdo — que por acaso era a Juracy. Assim, todo mundo caiu na mesma empresa.

## O que será feito

1. **Reconhecer a planilha corretamente**: procurar a linha de cabeçalho nas primeiras linhas do arquivo (não só na primeira), aceitar variações de nome de coluna por correspondência parcial (ex.: "NOME DO COLABORADOR", "CÓD. EMPRESA", "RAZÃO SOCIAL", "DATA DE ADMISSÃO") e reconhecer colunas de empresa por código, CNPJ ou razão social.
2. **Cada linha vai para a sua empresa**: quando a planilha tiver coluna de empresa, a empresa é resolvida linha a linha.
3. **Nunca mais "chute" de empresa**: se uma linha não permitir identificar a empresa com segurança, ela **não é gravada** — fica contada como linha sem empresa no resumo, e o arquivo aparece em "Aguardando revisão" com o motivo. O nome de empresa encontrado dentro do conteúdo deixa de servir como empresa padrão para planilhas com várias empresas.
4. **Resumo mais claro**: a mensagem final passa a mostrar quantas linhas foram lidas, quantas empresas foram atendidas e quantas linhas ficaram sem empresa.
5. **Limpeza da importação errada**: os 31 funcionários criados por engano na Juracy nesta sincronização (todos marcados como vindos do Drive, criados em 21/09 às 10:38) serão removidos, e os vínculos do arquivo também. Só serão apagados esses registros dessa importação — nada cadastrado manualmente. Confirme na aprovação; se preferir, faço apenas a correção da leitura e deixo a limpeza para depois.

## Detalhes técnicos

- `supabase/functions/employee-folder-sync/index.ts`:
  - `csvToEmployees`: varrer as primeiras ~15 linhas procurando a que produz o melhor mapeamento de colunas; `mapCsvHeaders` passa a casar por `includes` normalizado além de igualdade, com prioridade para correspondência exata; separar apelidos de empresa em `company_code` (código/SCI), `company_document` (CNPJ) e `company_name` (razão social/empresa/cliente).
  - Resolução por linha: `resolveClientFrom` recebe o valor específico da coluna; código SCI só vale quando vem de coluna de código, evitando casar número solto.
  - Remover o fallback `?? client` quando a planilha tem coluna de empresa: linha sem empresa resolvida incrementa `linhas_sem_empresa` e não gera cadastro.
  - Para arquivos CSV, a identificação de empresa no nível do arquivo deixa de usar razão social encontrada no conteúdo (mantida para PDFs); continua valendo CNPJ/código no nome do arquivo ou pasta.
  - `stats` ganha `linhas_sem_empresa` e `empresas_atendidas`.
- `src/pages/Personnel.tsx`: resumo da sincronização exibe os novos contadores.
- Limpeza: `delete` em `client_employees` restrito a `client_id` da Juracy, `source = 'drive'` e `created_at` da importação de 21/09 13:38 UTC; `delete` em `employee_documents` do `drive_file_id` da planilha.
- Sem alteração de estrutura do banco. Validação: `bunx tsgo --noEmit`, build limpo e nova sincronização real com a mesma planilha, conferindo que cada funcionário caiu na empresa certa.
