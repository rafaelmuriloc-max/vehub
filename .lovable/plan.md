## Incluir parcelamentos da PGFN na aba Parcelamentos

Hoje a aba Parcelamentos consulta apenas serviços da Receita Federal (Simples Nacional e MEI via `PEDIDOSPARC`). Vou adicionar também os parcelamentos administrados pela PGFN (Procuradoria-Geral da Fazenda Nacional), expostos pelo Integra Contador como o sistema `PARCMEPN` (Parcelamento de Débitos Inscritos em Dívida Ativa da União).

### Modalidades a adicionar (PGFN)

| Sistema | Serviço | Label |
|---|---|---|
| PARCMEPN | OBTERPARC241 | PGFN – Ordinário (Lei 10.522/2002) |
| PARCMEPN | OBTERPARC242 | PGFN – Simplificado |
| PARCMEPN | OBTERPARC243 | PGFN – PERT (Lei 13.496/2017) |
| PARCMEPN | OBTERPARC244 | PGFN – Negociação Excepcional |
| PARCMEPN | OBTERPARC245 | PGFN – Transação Extraordinária |
| PARCMEPN | OBTERPARC246 | PGFN – Transação Excepcional |

> Os códigos exatos serão confirmados ao receber a primeira resposta da edge function; caso o catálogo PGFN do contrato seja diferente, ajusto a lista mantendo a mesma estrutura. As modalidades RFB existentes permanecem inalteradas.

### Mudanças

1. **`src/components/integra-contador/ParcelamentosTab.tsx`**
   - Expandir o array `MODALIDADES` adicionando as entradas PGFN acima e um campo `origem: 'RFB' | 'PGFN'` em todas as linhas.
   - Mostrar uma coluna/badge "Origem" (RFB/PGFN) na tabela.
   - Adicionar filtro "Origem" (Todas / RFB / PGFN) ao lado do filtro de Modalidade.
   - A barra de progresso "Consultar selecionados/todos" passa a iterar sobre 14 serviços por cliente (8 RFB + 6 PGFN).
   - Tratar respostas vazias da PGFN como "sem parcelamento" (mesmo padrão atual).

2. **Banco — migração nova `parcelamento_results`**
   - Adicionar coluna `origem text not null default 'RFB' check (origem in ('RFB','PGFN'))`.
   - Recriar índice único para `(client_id, origem, modalidade, numero_parcelamento)` de modo que um mesmo número não colida entre RFB e PGFN.

3. **Edge function `integra-contador`**
   - Nenhuma mudança estrutural: o frontend só passa `idSistema=PARCMEPN` + `idServico` correspondente. A função já encaminha qualquer combinação ao SERPRO.

### Fora de escopo

- Emissão de DARF/DAS de parcelas PGFN.
- Detalhes de pagamento por parcela (DETPAGTOPARC PGFN).
- CRON automático.
