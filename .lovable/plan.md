# Importação do arquivo "E00195_REGISTROCOLABORADOR_092026.pdf"

## O que aconteceu

O arquivo foi lido, mas ficou em "Aguardando revisão" com o motivo **"Empresa não identificada"** — por isso nenhum funcionário entrou.

O sistema hoje só reconhece a empresa de duas formas: CNPJ escrito no caminho/nome do arquivo ou no texto do PDF, ou o nome da empresa na pasta. O arquivo está na raiz da pasta "Funcionários", o nome traz apenas o código **E00195**, e o CNPJ não foi encontrado no texto. O código 195 corresponde à empresa CAMIM LTDA, mas o sistema ainda não usa o código SCI para essa identificação.

## O que vou ajustar

1. **Reconhecer o código SCI no nome do arquivo e da pasta** — padrões como `E00195`, `00195`, `195-`, tratando zeros à esquerda. É o caminho que resolve este arquivo.
2. **Reconhecer o nome da empresa também dentro do texto do PDF**, não só na pasta.
3. **Reconhecer o CNPJ mesmo sem pontuação** no texto do documento.
4. **Registrar o motivo com mais detalhe** quando a empresa não for identificada (se o PDF tinha texto, quais códigos/CNPJs foram vistos), para facilitar o diagnóstico futuro.
5. **Reprocessar automaticamente** os arquivos que estão em "Aguardando revisão" na próxima sincronização, para que este arquivo entre sem precisar mexer no Drive.

## Detalhes técnicos

- `supabase/functions/employee-folder-sync/index.ts`: incluir `sci_code` na consulta de clientes e montar um mapa por código normalizado (sem zeros à esquerda); nova função `extractSciCodes` sobre nome/caminho; ordem de identificação: CNPJ → código SCI → razão social (caminho e texto do PDF).
- CNPJ: aceitar sequências de 14 dígitos sem máscara além do formato pontuado.
- `markPending`: mensagem de erro mais específica.
- Registros com `status = 'pending_review'` deixam de bloquear a reprocessagem quando o `modifiedTime` não mudou.
- Sem mudança de banco de dados. Validação com `bunx tsgo --noEmit`, build e nova sincronização real da pasta para confirmar que a ficha entra com todos os funcionários.
