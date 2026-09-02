# Notas fiscais de serviço: carregar todas as notas

## Problema confirmado

A aba NFS-e carrega as notas com uma única consulta sem paginação. O Supabase devolve no máximo 1.000 linhas por consulta, mas a tabela `invoices` tem **11.933 notas** (9.157 só deste ano). Por isso, ao escolher "Todos os períodos" (ou qualquer filtro amplo), só aparecem as 1.000 mais recentes — os filtros de período, cliente e tipo são aplicados no navegador, em cima desse recorte incompleto.

## Correção

Buscar as notas em blocos de 1.000 até trazer tudo, em vez de uma única consulta:

- Em `loadInvoices`, fazer um laço com `.range(offset, offset + 999)` ordenando por `issue_date` decrescente, acumulando os resultados até um bloco voltar com menos de 1.000 registros.
- Manter os dados em estado como hoje, para que filtros, totais, retenções, exportação e paginação de 20 por página continuem funcionando sem mudanças.
- Mostrar o indicador de carregamento enquanto os blocos são buscados (já existe `loading`).

## Detalhes técnicos

Arquivo: `src/components/invoices/NfseTab.tsx`, função `loadInvoices` (linhas ~145-153). Nenhuma mudança de banco, RLS ou edge function é necessária.

Como são ~12 blocos, o carregamento inicial fica um pouco mais lento. Se preferir, posso depois trocar por filtragem no servidor (período/cliente enviados na query com contagem total), mas isso exige reescrever os cálculos de totais e retenções — não está incluído nesta correção.
