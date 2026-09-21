# Excluir a última importação

## O que será apagado

A sincronização mais recente, feita hoje às 10:55 (horário de Brasília), a partir da planilha **EMPRESAS_REGISTROCOLABORADOR_092026.csv**:

- 66 funcionários cadastrados automaticamente, distribuídos em 52 empresas
- 66 vínculos dessa planilha na lista "Aguardando revisão"

## O que NÃO será tocado

- Os 19 funcionários da CAMIM, vindos da ficha em PDF (E00195), que continuam como estão
- Qualquer funcionário cadastrado manualmente por você
- A planilha no Google Drive (nada é apagado lá)
- O registro da planilha .xlsx pendente

## Depois da exclusão

A planilha volta a ser tratada como não lida, então uma nova sincronização pode importá-la de novo quando você quiser.

## Detalhes técnicos

- Remover de `client_employees` os registros com `source = 'drive'` criados entre 2026-09-21 13:55 e 13:56 UTC.
- Remover de `employee_documents` as linhas com `drive_file_id = '1EleqMLEOLXIy9wN9Jib8DZBk4LOHLjps'`.
- Conferir as contagens após a limpeza; nenhuma alteração de código ou de estrutura do banco.
