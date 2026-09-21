# Ler as fichas do SCI direto do relatório HTML

Testei o arquivo que você enviou (`EMPRESAS_REGISTROCOLABORADOR_092026.htm`). Ele tem **385 fichas** de **102 empresas**, e o leitor atual encontra as fichas mas não consegue extrair nenhum dado: os rótulos ficam numa linha e os valores na linha de baixo, alinhados por coluna, e hoje o leitor procura o valor na célula seguinte.

## O que muda

1. A leitura passa a casar cada rótulo com o valor que está **logo abaixo, na mesma coluna** — que é como o SCI monta o relatório.
2. De cada ficha são lidos: empresa, CNPJ, código, contrato, nome do trabalhador, CPF, data de admissão, função, salário inicial, forma de pagamento e data de rescisão.
3. A empresa vem sempre do **CNPJ da própria ficha**. Ficha cujo CNPJ não bate com nenhuma empresa cadastrada não é gravada e fica contada em "Aguardando revisão" — nunca cai numa empresa errada.
4. **Sócios/administradores** (27 fichas no seu arquivo) são importados, com o cargo identificando que é sócio.
5. **Salário R$ 0,00** é gravado como zero (31 fichas no seu arquivo).
6. Fichas com rescisão no passado entram como desligadas, com a data (27 fichas no seu arquivo).
7. Cadastro e atualização seguem a regra de sempre: cria quem não existe, completa só o que estiver vazio, nunca sobrescreve o que você digitou, nunca exclui ninguém.
8. O resumo ao final mostra: fichas encontradas, funcionários lidos, empresas atendidas, cadastrados, atualizados e fichas sem empresa.

Amostra conferida do seu arquivo: ELOARTH CONSTRUCAO LTDA / 11.705.830/0001-30 / KARLA MACCARI FERMINO FIGUEIREDO / 044.457.909-58 / admissão 01/04/2021 / SOCIO-ADMINISTRADOR; JM CAPOCCI RESTAURANTE LTDA / 37.524.011/0001-80 / Evandre Ricardo Cavaco / GERENTE / admissão 01/09/2020.

Numa amostra de 20 CNPJs do relatório, 15 existem no cadastro e 5 não — esses 5 ficariam em revisão. Depois de rodar eu comparo ficha a ficha e te mostro empresa por empresa.

## Detalhes técnicos

- `supabase/functions/employee-folder-sync/sciHtml.ts`: reescrever o parser para trabalhar por linhas/células com `colspan` (`<tr>`/`<td>`), em vez da lista plana de células. Para cada linha de rótulos, alinhar com a linha seguinte casando as larguras (`colspan`) em ordem — a linha de valores às vezes omite a célula vazia inicial. Rótulos reconhecidos por texto normalizado (NFD, minúsculas): `empregador`, `cnpj`, `codigo`, `contrato`, `nome do(a) trabalhador(a)`, `cpf`, `data de admissao`, `funcao`, `salario inicial`, `forma de pagamento`, `data rescisao`, `categoria`. Primeira ocorrência vence, para não confundir `Categoria` do RG com a trabalhista.
- Cada ficha continua delimitada pelo título `REGISTRO DE COLABORADORES`; `parseSciHtml` devolve `SciEmployee[]` com `company_document` preenchido.
- `parseMoney` passa a aceitar `R$ 0,00` retornando `0` (hoje descarta valores não positivos); `parseDate` já cobre `DD/MM/AAAA`.
- Sócio: quando `categoria` começar com `11` ou a função contiver `socio`/`diretor`/`titular`, o cargo gravado recebe o sufixo de sócio (ex.: `SOCIO-ADMINISTRADOR (sócio)` apenas quando a função não deixar claro) e o campo é preenchido normalmente.
- `supabase/functions/employee-folder-sync/index.ts`: manter o ramo `isHtmlFile` já criado (`text/html`, `.htm`/`.html`/`.xls` com conteúdo HTML), com `hasCompanyColumn = true` para que nunca haja empresa padrão; HTML não consome a cota de CPU dos PDFs; log por arquivo com fichas, empresas distintas e funcionários por empresa.
- `supabase/functions/employee-folder-sync/sciHtml.test.ts`: atualizar as fixtures para o formato real (rótulos numa `<tr>`, valores na `<tr>` seguinte, com `colspan`) e cobrir salário zero, ficha de sócio e ficha com rescisão.
- Sem alteração de banco de dados.
- Validação: rodar o parser contra o arquivo real (esperado 385 fichas, 102 empresas, 27 rescisões), `deno test` do parser, `bunx tsgo --noEmit`, build limpo, deploy da função e uma sincronização real com conferência por empresa.
