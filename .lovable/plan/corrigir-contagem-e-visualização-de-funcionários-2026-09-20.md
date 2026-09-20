# Corrigir contagem e visualização de funcionários

## Diagnóstico confirmado
- A sincronização mais recente leu o PDF inteiro em 3 blocos, encontrou 21 ocorrências e consolidou 19 pessoas vinculadas à CAMIM.
- A página mostra 16 porque o filtro inicial está em “Somente ativos”; os outros 3 registros estão como desligados.
- O arquivo informado contém 18 funcionários no total, incluindo os desligados. Portanto, além do filtro visual, existe 1 vínculo extra que precisa ser identificado e corrigido.

## Alterações
1. Alterar o filtro inicial da página Pessoal para **Todos**, exibindo ativos e desligados ao abrir uma empresa.
2. Mostrar no cabeçalho da empresa os totais separados: **18 no total**, ativos e desligados.
3. Adicionar a coluna **Data de rescisão** à tabela; para funcionários ativos, mostrar “—”.
4. Comparar os 19 vínculos atuais com os registros efetivos do PDF para identificar o falso positivo sem excluir nenhum funcionário legítimo.
5. Ajustar a extração para não interpretar nomes de responsáveis, assinaturas, referências ou pessoas repetidas como funcionários.
6. Reprocessar o arquivo da CAMIM e confirmar exatamente 18 vínculos, preservando dados preenchidos manualmente.

## Validação
- Abrir a CAMIM e confirmar 18 linhas com o filtro “Todos”.
- Conferir os totais de ativos e desligados e as respectivas datas de rescisão.
- Confirmar que uma nova sincronização não recria o vínculo indevido nem duplica pessoas.
- Validar tipagem, compilação e registros finais da sincronização.
