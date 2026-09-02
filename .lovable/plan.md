# NF-e: carregar todas as notas

## Problema confirmado

Na aba NF-e, o carregamento faz uma única consulta sem paginação (`nfe_invoices`, ordenada por data de emissão). O Supabase devolve no máximo 1.000 linhas por consulta, e a tabela tem **1.410 notas**. Portanto, cerca de 410 notas nunca aparecem — os filtros de período, cliente e direção são aplicados no navegador em cima desse recorte incompleto.

## Correção

Mesma abordagem já aplicada na aba NFS-e: buscar em blocos de 1.000 até trazer tudo.

- Em `loadInvoices`, laço com `.range(offset, offset + 999)` ordenando por `issue_date` decrescente, acumulando até um bloco voltar com menos de 1.000 registros.
- Manter os dados em estado como hoje, para que filtros, totais, exportação e paginação continuem funcionando sem mudanças.
- Indicador de carregamento existente (`loading`) permanece ativo durante os blocos.

## Detalhes técnicos

Arquivo: `src/components/invoices/NfeTab.tsx`, função `loadInvoices` (linhas ~123-131). Nenhuma mudança de banco, RLS ou edge function é necessária.
