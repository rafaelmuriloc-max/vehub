# Folha: escolher várias empresas e várias competências

## O que muda
- **Empresas:** a caixa de busca passa a permitir marcar várias empresas (com check em cada uma). O botão mostra "Todas as empresas", o nome quando for só uma, ou "N empresas". Há a opção "Limpar seleção" (volta para todas).
- **Competências:** o seletor de mês vira uma lista com check, onde dá para marcar vários meses. Atalhos: "Último mês" e "Todos". O botão mostra o mês, ou "N competências". Ao abrir a tela, o último mês vem marcado, como hoje.
- **Cards:** somam os valores de todas as empresas e meses marcados. Com mais de um mês, o card "Colaboradores ativos" mostra os ativos do mês mais recente marcado (para não contar a mesma pessoa várias vezes). Admitidos e demitidos somam os meses.
- **Evolução mensal:** mostra só os meses marcados (se marcar só um, mostra todos os meses, como hoje) e só as empresas marcadas.
- **Ranking:** considera os meses marcados, somando os valores de cada empresa no período; "Mais colaboradores" usa o mês mais recente. Clicar numa empresa do ranking liga/desliga ela na seleção.
- O título do ranking mostra o período ("08/2026" ou "07/2026 a 08/2026").

## Detalhes técnicos
- Apenas `src/pages/Payroll.tsx`: `clientIds: string[]` (vazio = todas) e `selectedMonths: string[]`, ambos com Popover + Command com múltipla seleção. Sem mudança no banco nem na sincronização.
- Validação: `bunx tsgo --noEmit` e build.
