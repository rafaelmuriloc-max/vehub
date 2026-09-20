# Arquivos com vários funcionários

Hoje a sincronização olha apenas o nome do arquivo e da pasta, então cada arquivo vira no máximo um funcionário. Uma ficha de registro em PDF com dez pessoas cria (ou atualiza) só uma.

## O que muda

Ao sincronizar a pasta, o sistema passa a **ler o conteúdo do PDF**, não só o nome:

1. Lê o texto de todas as páginas do arquivo.
2. Identifica **todas as pessoas** encontradas no documento, com nome, CPF, cargo, data de admissão, salário e data de desligamento quando aparecerem.
3. Para cada pessoa: se já existir na empresa (mesmo CPF ou mesmo nome), **atualiza** os campos que estiverem vazios; se não existir, **cadastra**.
4. O mesmo arquivo fica vinculado a todos os funcionários que ele contém, então aparece na linha de cada um deles.
5. Nada digitado manualmente é sobrescrito, e nenhum funcionário é excluído.

Se o PDF não tiver texto legível (documento escaneado como imagem), o arquivo continua caindo em "Aguardando revisão" com o motivo indicado, em vez de importar dados errados.

Quando o documento tiver uma pessoa só, o comportamento continua igual ao de hoje.

## Detalhes técnicos

- `supabase/functions/employee-folder-sync/index.ts`:
  - extrair texto do PDF com `npm:unpdf` (Deno) após o download do Drive; demais formatos continuam pelo nome/caminho.
  - trocar a extração por IA de objeto único para uma lista: tool `extract_employees` com `employees: [{ full_name, cpf, position, admission_date, salary, termination_date }]`, alimentada com os primeiros ~20 mil caracteres do texto + caminho do arquivo.
  - empresa continua identificada por CNPJ/razão social no caminho — e agora também pelo CNPJ dentro do texto do PDF.
  - para cada funcionário retornado: busca por CPF, senão por nome na mesma empresa; `insert` quando não existir, `update` apenas nos campos nulos quando existir.
  - devolver nos resultados quantos funcionários foram criados/atualizados por arquivo.
- `employee_documents`: hoje a chave única é `drive_file_id`, o que permite só um vínculo por arquivo. Migração para permitir **um registro por (arquivo, funcionário)**: trocar o índice único por `(drive_file_id, employee_id)` e manter a limpeza dos vínculos antigos do arquivo antes de regravar, para evitar duplicatas quando o PDF for alterado.
- `src/pages/Personnel.tsx`: nenhuma mudança estrutural — os documentos já são agrupados por funcionário; apenas o resumo da sincronização passa a mostrar também a quantidade de fichas lidas.
- Validação: `bunx tsgo --noEmit`, build limpo e um teste real com uma ficha de registro contendo vários funcionários.
