

# Adicionar filtro de obrigações no calendário

## O que será feito
Adicionar um terceiro filtro (ao lado de Departamento e Empresa) para selecionar uma obrigação específica. Será um Select com a lista de obrigações, filtrado pelo departamento selecionado quando aplicável.

## Alterações em `src/pages/CalendarView.tsx`

### 1. Novo estado
- `const [filterObligation, setFilterObligation] = useState('all');`

### 2. Filtro no memo `events`
- Adicionar condição: `if (filterObligation !== 'all' && inst.obligation_id !== filterObligation) continue;`
- Adicionar `filterObligation` nas dependências do `useMemo`

### 3. Resetar filtro quando departamento mudar
- No `onValueChange` do filtro de departamento, adicionar `setFilterObligation('all')`

### 4. UI do filtro (entre Empresa e o fechamento do flex)
- Adicionar um `Select` com label "Obrigação"
- Opção "Todas as obrigações" (value `all`)
- Listar obrigações filtradas pelo departamento selecionado (se `filterDept !== 'all'`, mostrar só as do departamento)
- Largura `w-[280px]`

## Arquivos
- `src/pages/CalendarView.tsx`

