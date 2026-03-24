

# Calendário de Obrigações com Filtros e Lista Diária

## Objetivo
Reescrever a página de calendário para exibir obrigações geradas (`obligation_instances`) com marcações coloridas nas 3 datas (Alerta/Verde, Meta/Laranja, Vencimento/Vermelho). Abaixo do calendário, exibir a lista de empresas e obrigações do dia selecionado. Incluir filtros por departamento e por empresa.

## Mudanças

### Arquivo: `src/pages/CalendarView.tsx` (reescrita completa)

**Dados carregados**:
- `obligation_instances` (todas, com client_id, obligation_id, reference_month)
- `obligations` (name, department_id, alert_day, target_day, due_day)
- `clients` (id, company_name)
- `departments` (id, name)

**Cálculo de datas por instância**:
Para cada instance, calcular 3 datas reais a partir do `reference_month` + dias da obligation:
- `alert_date` = reference_month.setDate(alert_day)
- `target_date` = reference_month.setDate(target_day)  
- `due_date` = reference_month.setDate(due_day)

**Calendário**:
- Manter o grid mensal atual com navegação
- Em cada célula do dia, mostrar dots/badges coloridos (verde/laranja/vermelho) indicando quantas obrigações têm aquela data naquele dia
- Dia clicável para selecionar

**Lista abaixo do calendário**:
- Ao selecionar um dia, exibir tabela com: Empresa, Obrigação, Departamento, Tipo de data (Alerta/Meta/Vencimento) com badge colorido correspondente

**Filtros** (acima do calendário):
- Select de Departamento (todos / específico)
- Select de Empresa (todos / específica)
- Filtros aplicados tanto ao calendário quanto à lista

### Detalhes técnicos

```text
Layout:
┌─────────────────────────────────────────────┐
│ [Filtro Departamento ▼] [Filtro Empresa ▼]  │
├─────────────────────────────────────────────┤
│        ◀  Março 2026  ▶                     │
│ Dom Seg Ter ... Sáb                         │
│  1   2   3  ...                             │
│     🟢🟠  🔴   (dots por tipo de data)     │
├─────────────────────────────────────────────┤
│ Obrigações do dia 15/03/2026                │
│ ┌────────────┬──────────┬──────┬──────────┐ │
│ │ Empresa    │Obrigação │Depto │ Tipo     │ │
│ │ Acme Ltda  │ DCTF     │Fiscal│🟠 Meta  │ │
│ │ Beta SA    │ eSocial  │Pessoal│🟢Alerta│ │
│ └────────────┴──────────┴──────┴──────────┘ │
└─────────────────────────────────────────────┘
```

- Cores: verde (`bg-green-500`) para alerta, laranja (`bg-orange-500`) para meta, vermelho (`bg-red-500`) para vencimento
- Dots pequenos no calendário para não sobrecarregar visualmente
- Sem mudanças no banco de dados

