# Adicionar ARR no card de MRR da página Clientes

## Objetivo
No card de MRR existente na página `/clients`, exibir também o ARR (Annual Recurring Revenue = MRR × 12), mantendo o mesmo estilo dos cards de métricas.

## Alterações previstas

### `src/pages/Clients.tsx`
1. **Cálculo**: adicionar `const arr = mrr * 12;` logo após o cálculo do `mrr`.
2. **Card de MRR**: alterar o card na linha ~1074 para:
   - Título: "MRR / ARR".
   - Valor principal continua sendo o MRR formatado.
   - Subtítulo/hint mostrando `ARR = R$ {arr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.
   - Layout interno em duas linhas: MRR em destaque e ARR logo abaixo em tom `text-muted-foreground`.

## Fora de escopo
- Não alterar cálculo de MRR, filtros, backend, banco de dados ou outros cards.
- Não modificar rotas, edge functions ou tabelas.

## Critério de aceitação
- O card exibe MRR e ARR corretamente.
- ARR é sempre 12 × MRR.
- Build e typecheck passam.
