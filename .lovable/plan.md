

# Adicionar tipo de folha na segmentação de obrigações

## O que será feito
Quando o checkbox "Empresas com Folha de Pagamento" estiver ativo, exibir um select para escolher o tipo de folha: "Todas", "Folha Normal" ou "Só Pró-labore". Isso filtra clientes pelo campo `payroll_type`.

## Alterações em `src/pages/Obligations.tsx`

### 1. Estado do formulário
- Substituir `segment_has_payroll: boolean` por `segment_payroll_filter: string` com valores: `''` (desativado), `'all'` (qualquer folha), `'normal'` (só Normal), `'pro_labore'` (só Pró-labore).
- Atualizar `openNewObligation`, `openEditObligation`, e `saveObligation` para usar o novo campo.

### 2. Lógica de filtro (`getFilteredClients`)
- Quando `payroll_filter === 'all'`: cliente precisa ter `payroll_type` não nulo.
- Quando `payroll_filter === 'normal'`: `payroll_type === 'Normal'`.
- Quando `payroll_filter === 'pro_labore'`: `payroll_type === 'Pró-labore'`.

### 3. UI (linhas ~608-616)
- Manter o Checkbox "Empresas com Folha de Pagamento".
- Quando ativado, exibir um Select com opções: "Todas as folhas", "Folha Normal", "Só Pró-labore".

### 4. Persistência (`segment_filters` JSONB)
- Salvar `payroll_type: 'all' | 'normal' | 'pro_labore'` em vez de `has_payroll: true`.
- Manter retrocompatibilidade: ao carregar `has_payroll: true` antigo, tratar como `'all'`.

## Arquivo
- `src/pages/Obligations.tsx` (sem migration necessária — dados já são JSONB flexível)

