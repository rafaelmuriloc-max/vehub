

# Adicionar 3 Datas e Periodicidade nas Obrigações

## Problema
As obrigações atualmente só possuem o campo `recurrence` com opções limitadas (mensal, trimestral, anual). Faltam:
- 3 campos de data com cores (Vencimento/Vermelho, Meta/Laranja, Alerta/Verde)
- Opções de periodicidade: diária, semanal, quinzenal, mensal, anual

## Mudanças

### 1. Migration: Adicionar colunas na tabela `obligations`
```sql
ALTER TABLE obligations
  ADD COLUMN due_day integer,          -- dia do vencimento (ex: dia 20)
  ADD COLUMN target_day integer,       -- dia meta (ex: dia 15)
  ADD COLUMN alert_day integer;        -- dia alerta/início (ex: dia 1)
```
Os campos são "dia do mês/período" (integer) pois as datas reais são calculadas por competência na instância. Isso permite definir: "alerta no dia 1, meta no dia 15, vencimento no dia 20" de cada período.

### 2. Atualizar `src/pages/Obligations.tsx`

**Type**: Adicionar `due_day`, `target_day`, `alert_day` ao tipo `Obligation`.

**Form**: Adicionar 3 campos numéricos com indicadores coloridos:
- 🟢 **Dia Alerta** (verde) - início da execução
- 🟠 **Dia Meta** (laranja) - prazo interno do escritório
- 🔴 **Dia Vencimento** (vermelho) - prazo final com multa

**Periodicidade**: Substituir as opções atuais (mensal/trimestral/anual) por: `diária`, `semanal`, `quinzenal`, `mensal`, `anual`.

**Listagem**: Exibir as 3 datas com badges coloridos ao lado do nome da obrigação (ex: `🟢 D1 🟠 D15 🔴 D20`).

**Save**: Incluir os novos campos no payload de insert/update.

### Detalhes técnicos

- A migration adiciona 3 colunas nullable integer à tabela `obligations`
- O formulário usa `Input type="number"` com min=1 max=31 para cada dia
- Cada campo tem um indicador de cor (dot ou border colorido)
- As opções de `recurrence` passam de 3 para 5

