

# Atualização Única de Regime Tributário dos Clientes Existentes

## O que será feito

Criar uma edge function que será chamada uma única vez (manualmente ou via botão temporário) para percorrer todos os clientes com CNPJ cadastrado, consultar a BrasilAPI e atualizar o campo `tax_regime`. Sem botão permanente na interface.

## Abordagem

### 1. Edge Function `batch-update-tax-regime`
- Busca todos os clientes com `document` preenchido (14 dígitos)
- Para cada um, consulta `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`
- Aplica a regra: MEI → `mei`, Simples → `simples_nacional`, senão → `lucro_presumido`
- Atualiza o registro no Supabase se o regime mudou
- Delay de 1s entre chamadas para evitar rate limit da BrasilAPI
- Retorna relatório com total atualizado e erros

### 2. Execução única
- Após deploy, chamar a function uma vez via curl ou pelo dashboard do Supabase
- A function pode ser removida depois, ou mantida para uso futuro

### 3. Cadastro de novos clientes (já implementado)
- A lógica em `fetchCnpjData()` no `Clients.tsx` já preenche automaticamente o `tax_regime` ao consultar CNPJ — nada muda aqui.

## Detalhes técnicos

| Item | Detalhe |
|---|---|
| Arquivo | `supabase/functions/batch-update-tax-regime/index.ts` |
| API | `brasilapi.com.br/api/cnpj/v1/{cnpj}` |
| Auth | Requer service role key (já disponível como secret) |
| Delay | 1s entre chamadas |

