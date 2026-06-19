O SERPRO rejeitou `03/2026` como período desnecessário em `receitasBrutasAnteriores` para PA=202604. A regra do PGDAS-D é que essa lista representa os 12 meses **anteriores ao mês imediatamente anterior** ao PA (de PA-13 até PA-2), pois PA-1 é tratado separadamente.

## Mudança

Em `src/components/integra-contador/PgdasdDeclaracaoForm.tsx`, ajustar `calcPrevMonths` para começar em PA-2 (decrementar duas vezes antes de iniciar o loop), gerando os 12 meses corretos: PA-2 até PA-13.

Sem outras alterações.