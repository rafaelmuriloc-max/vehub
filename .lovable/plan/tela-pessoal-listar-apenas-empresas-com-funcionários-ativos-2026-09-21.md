# Tela Pessoal: listar apenas empresas com funcionários ativos

## O que muda

Na página **Pessoal** (`/personnel`), a lista de empresas passa a exibir **somente empresas que têm pelo menos um funcionário ativo**. Empresas sem funcionário ativo somem da lista (continuam contando no card "Empresas sem funcionário(s) ativo(s)").

## Detalhes de implementação

- Arquivo único: `src/pages/Personnel.tsx`.
- No `useMemo` de `filteredClients` (linhas ~173-181), adicionar o filtro de empresas com ativos antes da busca:
  - `const idsComAtivos = new Set(activeEmployees.map(e => e.client_id))`
  - base da lista = `clients.filter(c => idsComAtivos.has(c.id))`; a busca atual (nome/CNPJ/código SCI) continua aplicada sobre esse resultado.
- Dependências do `useMemo` passam a incluir `activeEmployees`.
- Nada mais muda: paginação, busca, filtro de situação, expansão, cards de totais e sincronização seguem iguais.
- O terceiro card continua mostrando o total geral do escritório (empresas com ativos e o detalhe de quantas ficaram sem) — ele não é afetado pela lista.

## Validação

- `bunx tsgo --noEmit` sem erros.
- Build limpo (`build-errors.log` com "build OK").
- Conferência visual no preview: a lista só traz empresas com funcionários ativos e a paginação acompanha o novo total.
