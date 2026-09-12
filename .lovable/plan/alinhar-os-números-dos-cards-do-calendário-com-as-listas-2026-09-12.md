# Alinhar os números dos cards do calendário com as listas

## O que está acontecendo (verificado no código)

Os cartões do topo ("A fazer", "Atrasadas", "Concluídas", "Fora do prazo") e as listas
mensais escolhem as obrigações do mês por critérios diferentes:

- **Cartões**: pegam a obrigação se a competência **ou** o vencimento caem no mês, e
  descartam toda empresa com serviços suspensos.
- **Listas**: pegam a obrigação se alguma das datas exibidas no calendário (alerta, meta
  ou vencimento, já antecipadas para dia útil) cai no mês, exigem empresa/departamento
  carregados e só tratam a empresa suspensa como suspensa a partir da primeira data dela.

Daí as diferenças que você viu (203 x 179 em "A fazer", 136 x 137 em "Concluídas"):
obrigações cuja data antecipada cai em outro mês, obrigações sem nenhuma data cadastrada e
empresas suspensas com datas futuras entram de um lado e não do outro.

## O que será feito

1. Passar a usar **um único critério** de "obrigação do mês": exatamente o mesmo que já
   monta as listas (data de alerta/meta/vencimento dentro do mês, uma linha por obrigação).
2. Os cartões e os gráficos de desempenho (geral e por departamento) passam a contar sobre
   esse mesmo conjunto, com as mesmas exclusões das listas: em "Aguardando", suspensas e
   excluídas ficam de fora dos cartões, como já ficam das abas.
3. As classificações continuam iguais: concluída, atrasada (vencimento já passou),
   vence hoje, fora do prazo. A soma dos cartões passa a bater com as abas
   "A fazer" / "Atrasadas" / "Concluídas" / "Fora do prazo".
4. A comparação com o mês anterior continua funcionando, usando o mesmo critério aplicado
   ao mês anterior.

## Detalhes técnicos

- `src/pages/CalendarView.tsx`:
  - extrair um helper `monthInstanceEvents(year, month)` que reaproveita a lógica de
    `events` + dedupe por instância já usada em `monthEvents` (prioridade due > target >
    alert), incluindo o `previousBusinessDay` com os feriados do ano-alvo;
  - `monthEvents` passa a chamar esse helper para o mês corrente (sem mudança de
    comportamento das abas);
  - `dashboardStats` e `departmentPerformance` deixam de iterar `instances` por
    `reference_month`/`due_date` e passam a iterar o resultado do helper, aplicando
    `onHoldIds` e `isSuspendedEvent` (mesma regra das listas) em vez de
    `services_suspended` direto;
  - manter os filtros atuais (departamento, empresa, obrigação, regime, "fora do prazo"),
    que já são aplicados na construção de `events`.
- `src/components/performance/OperationPerformance.tsx`: alinhar o mesmo critério de
  seleção do mês para o painel do início não divergir do calendário.
- Sem alterações de banco, RLS ou edge functions.

## Validação

- Conferir no mês atual que "A fazer", "Atrasadas", "Concluídas" e "Fora do prazo" dos
  cartões batem com os contadores das abas correspondentes.
- Conferir que o total dos cartões equivale ao número de obrigações listadas no mês.
