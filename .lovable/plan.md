# Filtro "Últimos 3 meses" na página de Chamados

Adicionar uma opção de período de 90 dias corridos no filtro da página `/tickets`, para que o usuário possa carregar os chamados dos últimos 3 meses na lista.

## Como vai funcionar

- No seletor de período da página de chamados, incluir a opção **"Últimos 3 meses"**.
- Ao selecioná-la, a lista carrega chamados abertos a partir de `hoje - 90 dias`.
- Nenhum outro filtro é aplicado automaticamente; o usuário continua podendo combinar com situação, responsável, departamento e busca se desejar.
- A contagem de total/paginação e o relatório PDF reaproveitam o mesmo `sinceIso`, então também passam a suportar o novo período.

## Técnico

- Arquivo alterado: `src/pages/Tickets.tsx`.
- Adicionar `{ value: '90', label: 'Últimos 3 meses' }` ao array `PERIODS`.
- O `sinceIso` já trata valores numéricos via `d.setDate(d.getDate() - Number(period))`, então `period === '90'` funcionará sem mudanças na lógica de cálculo.
- Garantir que o `Select` exiba a nova opção.
- Sem alterações de banco de dados, edge functions ou outros componentes.
