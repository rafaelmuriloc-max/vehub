# Corrigir a releitura manual dos funcionários

## Diagnóstico confirmado
- A sincronização mais recente terminou às 17:27 (horário de São Paulo).
- O PDF da CAMIM continua marcado como já importado e possui 10 funcionários vinculados.
- Como o arquivo não mudou no Google Drive, a rotina o ignorou antes de executar a nova leitura em blocos; por isso o resultado mostrou zero funcionários encontrados.

## Implementação
1. Fazer o botão **Sincronizar pasta** solicitar uma sincronização forçada.
2. Na sincronização forçada, reler também arquivos já importados, mesmo sem alteração no Google Drive.
3. Manter a sincronização automática econômica: ela continuará ignorando arquivos inalterados.
4. Preservar os funcionários existentes, cadastrar os faltantes e atualizar somente campos vazios.
5. Manter o vínculo do mesmo PDF com todos os funcionários encontrados e sinalizar leitura parcial quando algum bloco falhar.

## Validação
- Executar a sincronização manual com o PDF da CAMIM.
- Conferir quantos funcionários foram encontrados, cadastrados e vinculados ao arquivo.
- Confirmar que os registros existentes não foram duplicados nem sobrescritos.
- Validar a tela Pessoal e a compilação do aplicativo.
