

# Geração de obrigações anuais: Ano de início em vez de Mês de início

## Problema
Para obrigações anuais, o seletor atual pede "Mês de início" e gera de mês X a dezembro. Mas para anuais (ex: DEFIS), o correto é escolher o **ano-calendário** (ex: 2025), e o sistema gerar uma única instância no mês configurado (`annual_month`, ex: março) do **ano seguinte** (2026), com `reference_month` referente ao ano-calendário escolhido.

## Solução

### 1. Adicionar estado `generateStartYear` em `Obligations.tsx`
Novo estado para armazenar o ano selecionado quando a obrigação é anual.

### 2. Alterar UI de geração (linhas 755-788)
Quando `editingObligation.recurrence === 'anual'`:
- Trocar o seletor de "Mês de início" por "Ano de início" (ex: 2024, 2025, 2026)
- Texto descritivo: "Será gerada obrigação DEFIS em **Março/2026** referente ao ano-calendário **2025** para **100** empresa(s)"

Quando mensal: manter o comportamento atual.

### 3. Alterar lógica de geração (`generateObligationInstances`, linhas 233-286)
Para obrigações anuais:
- Usar o ano selecionado como ano-calendário
- O `annual_month` define o mês da instância
- Se `competence_rule === 'previous'`, a instância é gerada no `annual_month` do **ano seguinte** (ano-calendário + 1), com `reference_month` = `{ano-calendário + 1}-{annual_month}-01`
- Se `competence_rule === 'current'`, a instância é no `annual_month` do **mesmo ano**, com `reference_month` = `{ano}-{annual_month}-01`
- `due_date` usa o `due_day` no mesmo mês/ano da instância

### 4. Também atualizar `ClientObligationsTab.tsx`
Mesma lógica de geração para a aba de obrigações por cliente — aplicar condição para anuais.

## Arquivos
- `src/pages/Obligations.tsx` (~20 linhas alteradas: novo estado, UI condicional, lógica de geração)
- `src/components/ClientObligationsTab.tsx` (ajuste menor na geração anual)

