# Corrigir a atualização de salários pelo Espelho Resumo da Folha

## O que está acontecendo
- O relatório de agosto/2026 traz **319 funcionários** com "Salário base", mas o leitor atual só consegue pegar **112**. Na maioria das vezes é o primeiro funcionário de cada empresa.
- Os outros funcionários vêm logo depois dos totais do funcionário anterior, na mesma linha do relatório (ex.: "... 1.930,00 **84 VALMIR VENANCIO RODRIGUES** 0 0 Admissão em 09/03/2026 Salário base 2.661,00"). O leitor espera o código e o nome em posições fixas e perde esses casos.
- Por isso só uma parte dos salários mudou na página Pessoal: 77 funcionários foram atualizados hoje.

## Correção
- Reescrever a leitura dos funcionários no leitor da folha. Em vez de contar posições, ele vai achar cada "Admissão em dd/mm/aaaa Salário base N" e pegar o que vem logo antes: o código e o nome, seguidos de "SF" e "IR" (os dois números antes de "Admissão").
- Cada funcionário fica ligado à empresa do bloco em que aparece, pelo CNPJ.
- O jeito de achar o funcionário no cadastro continua o mesmo: primeiro pelo código (007 = 7), depois pelo nome. Ninguém é criado ou apagado, e o mês mais recente continua valendo.
- Depois de publicar, é só clicar em Sincronizar na tela Folha para os salários serem atualizados.

## Detalhes técnicos
- `supabase/functions/employee-folder-sync/sciPayroll.ts`: extrair funcionários do texto linear de cada bloco de empresa com uma regex ancorada em `(\d+)\s+([A-ZÀ-Ü][A-ZÀ-Ü' .-]+?)\s+\d+\s+\d+\s+Admiss[aã]o em (\d{2}/\d{2}/\d{4})\s+Sal[aá]rio base ([\d.,]+)`.
- `sciPayroll.test.ts`: novo teste com o arquivo real, esperando 319 funcionários (incluindo VALMIR VENANCIO RODRIGUES, código 84, R$ 2.661,00).
- Publicar `employee-folder-sync`. A tela e o banco não mudam.
