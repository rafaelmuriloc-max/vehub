# Importar todos os funcionários de fichas longas

## Situação

Na ficha da CAMIM (`E00195_REGISTROCOLABORADOR_092026.pdf`) o sistema gravou 10 pessoas, enquanto o arquivo tem 19. O arquivo consta como importado, sem erro registrado — ou seja, a leitura foi parcial, não falha.

Causa mais provável: o texto do PDF é enviado à leitura automática cortado nos primeiros 20.000 caracteres, e uma resposta única também pode ficar incompleta. Fichas com muitas pessoas ultrapassam esse limite, então as últimas ficam de fora.

## O que será feito

1. Deixar de cortar o texto: o conteúdo da ficha passa a ser lido em blocos sequenciais, com sobreposição entre eles para não perder ninguém na emenda.
2. Juntar o resultado de todos os blocos, eliminando repetições pelo CPF (ou pelo nome, quando não houver CPF).
3. Registrar no relatório de sincronização quantas pessoas foram encontradas no arquivo e quantos blocos foram lidos, para conferência.
4. Se um bloco falhar na leitura, o arquivo deixa de ser marcado como importado completo e aparece com aviso, em vez de gravar só uma parte em silêncio.
5. Reprocessar a ficha da CAMIM: pessoas já cadastradas continuam como estão (nada é sobrescrito ou excluído), e as faltantes entram.

## Detalhes técnicos

- `supabase/functions/employee-folder-sync/index.ts`: `aiExtractEmployees` passa a receber o texto completo e dividi-lo em pedaços de ~18k caracteres com ~1k de sobreposição, chamando o modelo por pedaço em série; deduplicação por CPF normalizado e, na ausência dele, por nome normalizado.
- Chamadas por arquivo limitadas (teto de blocos) para respeitar o tempo de execução da função; se o teto for atingido o arquivo é marcado como parcialmente lido.
- `stats` ganha `funcionarios_encontrados` e o toast em `src/pages/Personnel.tsx` passa a exibi-lo.
- Sem alteração de banco de dados. Validação: `bunx tsgo --noEmit`, build e nova sincronização real conferindo as 19 pessoas.
