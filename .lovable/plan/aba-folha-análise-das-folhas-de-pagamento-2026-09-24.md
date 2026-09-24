# Aba Folha: análise das folhas de pagamento

## O que muda
- Na página Pessoal aparece um botão **Folha** ao lado de **Férias**. Ele abre a nova tela de análise da folha.
- No botão **Sincronizar** entra uma quarta opção, **Folha**. Ela lê só o relatório "Espelho e resumo da folha" (RELATORIO_ESPELHO_RESUMO) que está na pasta do Drive que já usamos.

## Como a sincronização funciona
- O relatório traz o mês de referência (ex.: AGOSTO/2026) e um bloco por empresa, identificada pelo CNPJ.
- De cada empresa guardamos o resumo geral daquele mês: quantidade de colaboradores, empregadores, autônomos e estagiários, proventos, descontos, líquido, base e valor de INSS, base e valor de FGTS, base de IRRF, e também ativos, admitidos e demitidos.
- Cada mês fica guardado separado. Se você sincronizar de novo o mesmo mês, os números daquele mês são trocados pelos novos. Os meses anteriores continuam guardados, e é com eles que o sistema monta a evolução e as consultas.
- Empresa que não for encontrada pelo CNPJ não entra nos números e aparece no resumo como "sem empresa". A leitura segue a estrutura do relatório, sem IA.

## A tela Folha
- **Filtros:** empresa (com busca por nome, CNPJ ou código, ou "Todas as empresas") e mês.
- **Totais do mês (cards):** proventos, descontos, líquido, INSS, FGTS, colaboradores ativos, admitidos e demitidos.
- **Evolução mensal:** gráfico mês a mês de proventos, líquido e encargos, com a quantidade de colaboradores.
- **Ranking de empresas:** empresas com maior folha, mais colaboradores e mais encargos. Clicar numa empresa filtra a tela por ela.
- Empresas inativas ficam fora, como nas telas Pessoal e Férias.

## Detalhes técnicos
- Nova tabela `payroll_summaries` com um registro por (client_id, competência), campos numéricos do resumo geral, o nome do arquivo e a data da sincronização. Terá GRANTs e RLS no mesmo padrão de `employee_vacation_periods`, e a gravação usa upsert por (client_id, competência).
- Novo leitor `supabase/functions/employee-folder-sync/sciPayroll.ts`, feito para o HTML FastReport do SCI: a competência vem do título, os blocos são separados por "Empresa:/CNPJ", e os valores saem do bloco "RESUMO GERAL" e da linha "Ativos/Admitidos/Demitidos". Terá testes com o arquivo enviado.
- Na função `employee-folder-sync`, entra o modo `only: "folha"` com `isPayrollFileName` (nome com "espelho" ou "resumo" e "folha", extensão .html/.htm/.xls). O resumo da sincronização passa a contar empresas e meses gravados.
- Nova página `src/pages/Payroll.tsx`, na rota `/folha` (em `src/App.tsx`), com gráficos em Recharts e a caixa de busca já usada no sistema. Em `Personnel.tsx` entram o botão e o item no menu de sincronização.
- Validação: testes do leitor, `bunx tsgo --noEmit`, build e publicação da função.
