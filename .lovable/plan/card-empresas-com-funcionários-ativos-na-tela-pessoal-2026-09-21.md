# Card "Empresas com funcionários ativos" na tela Pessoal

## O que muda

Na página **Pessoal** (`/personnel`), a linha de cards de resumo passa de dois para três:

1. **Total de funcionários ativos** (já existe)
2. **Total de salários** (já existe)
3. **Empresas com funcionários ativos** (novo) — contagem de empresas que têm **pelo menos um** funcionário com `status = 'active'`.

## Detalhes de implementação

- Arquivo único: `src/pages/Personnel.tsx`.
- Um `useMemo` calcula a partir dos dados já carregados em `loadAll`, sem nova consulta ao banco:
  - `clientsWithActive = new Set(employees.filter(e => e.status === 'active').map(e => e.client_id)).size`
- Layout: a grade dos cards passa de `sm:grid-cols-2` para `sm:grid-cols-3` (empilhando em uma coluna no celular, como hoje).
- Novo card no mesmo padrão visual dos outros: rótulo em caixa alta, número grande e ícone (`Building2`, já importado).
- Texto de apoio: "X empresa(s) sem funcionário(s) ativo(s)" (empresas ativas carregadas menos as que têm ativos).
- O card mostra o total geral do escritório — não muda com busca, filtro ou paginação.
- Sem alterações de banco, migração ou tipagem nova.

## Validação

- `bunx tsgo --noEmit` sem erros.
- Build limpo (`build-errors.log` com "build OK").
- Verificação visual no preview: os três cards aparecem e a contagem bate com as empresas que exibem funcionários ativos na lista.
