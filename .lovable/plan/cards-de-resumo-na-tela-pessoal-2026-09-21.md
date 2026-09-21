# Cards de resumo na tela Pessoal

## O que muda

Na página **Pessoal** (`/personnel`), abaixo do título e acima do card de filtros, aparecem dois cards de resumo:

1. **Total de funcionários ativos** — contagem de todos os funcionários com `status = 'active'` de todas as empresas carregadas.
2. **Total de salários** — soma dos salários (`salary`) dos funcionários **ativos**, formatada em reais (padrão BRL, `toLocaleString('pt-BR')`), com o número de funcionários considerados como texto de apoio.

## Detalhes de implementação

- Arquivo único: `src/pages/Personnel.tsx`.
- Um `useMemo` calcula a partir de `employees` (já carregados em `loadAll`, sem nova consulta ao banco):
  - `totalAtivos = employees.filter(e => e.status === 'active').length`
  - `totalSalarios = soma de salary dos ativos`
- Layout: grade responsiva (`grid grid-cols-1 sm:grid-cols-2 gap-4`), cada card com rótulo em caixa alta, número grande e ícone (`Users` para ativos, `Wallet` para salários).
- Os cards refletem o total geral do escritório — **não** são afetados pela busca, pelo filtro de situação nem pela paginação.
- Sem alterações de banco, migração ou tipagem nova.

## Validação

- `bunx tsgo --noEmit` sem erros.
- Build limpo (`build-errors.log` com "build OK").
- Verificação visual no preview: os dois números aparecem e batem com os totais por empresa exibidos na lista.
