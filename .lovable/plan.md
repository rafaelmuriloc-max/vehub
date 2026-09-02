# Acelerar o carregamento das Notas Fiscais

Hoje, toda vez que a tela de Notas Fiscais é aberta (ou se troca de aba), o sistema baixa **todas** as notas do banco de novo: ~11.9 mil NFS-e e ~1.4 mil NF-e, em blocos sequenciais de 1.000 registros. Nada fica em cache, então a espera se repete em cada navegação.

## O que muda

1. **Cache entre navegações**
   Migrar o carregamento de NFS-e, NF-e e NFC-e para React Query com cache (dados válidos por alguns minutos). Ao voltar para a tela, a lista aparece na hora e só é atualizada em segundo plano.

2. **Buscar apenas o período selecionado**
   O filtro de datas passa a ser aplicado no banco (não mais depois de baixar tudo). Período padrão continua o atual; "Todos os períodos" continua disponível, mas passa a ser uma escolha explícita e mais pesada.

3. **Buscar só as colunas usadas**
   Trocar `select('*')` pela lista de campos realmente exibidos/calculados (valores, retenções, datas, cliente, chaves/URLs), reduzindo bastante o volume trafegado.

4. **Blocos em paralelo**
   Quando ainda for necessário paginar (ex.: "Todos os períodos"), buscar os blocos de 1.000 em paralelo (usando a contagem total) em vez de um após o outro.

5. **Atualização após sincronizar**
   Após a busca de notas no portal / sync, o cache é invalidado para refletir os novos registros imediatamente.

## Detalhes técnicos

- Arquivos: `src/components/invoices/NfseTab.tsx`, `src/components/invoices/NfeTab.tsx`, `src/components/invoices/NfceTab.tsx`.
- `QueryClient` em `src/App.tsx` recebe defaults (`staleTime` ~5 min, `gcTime` ~30 min, `refetchOnWindowFocus: false`).
- `loadInvoices()` vira `useQuery` com chave incluindo cliente/período; filtros de data via `.gte('issue_date', from).lte('issue_date', to)`.
- A lista de clientes (`loadClients`) também vira query em cache compartilhado.
- Totais, retenções, exportação e paginação de 20 linhas permanecem iguais.
