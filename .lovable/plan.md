

# Flag de Retenção em Obrigações + Geração Automática (Notas Tomadas)

## Visão Geral
Adicionar flag "É Retenção" no cadastro de obrigações. A verificação automática mensal analisa as **notas de serviços tomados** (onde o cliente é o tomador, não o prestador) para detectar impostos retidos e gerar instâncias de obrigação automaticamente.

A lógica de "tomado" já existe no sistema: uma nota é "tomada" quando `issuer_cnpj !== cnpj do cliente` (o cliente aparece como tomador do serviço).

## 1. Migration — Novas colunas na tabela `obligations`

```sql
ALTER TABLE obligations ADD COLUMN is_retention boolean NOT NULL DEFAULT false;
ALTER TABLE obligations ADD COLUMN retention_tax_type text;
-- retention_tax_type: 'iss', 'inss', 'irrf', 'pis', 'cofins', 'csll', 'cp'
```

## 2. Frontend — `src/pages/Obligations.tsx`

- Adicionar `is_retention` e `retention_tax_type` ao type `Obligation` e ao formulário
- Quando `is_tax = true`, exibir Switch "É Retenção?"
- Quando `is_retention = true`, exibir Select "Tipo de Retenção" (ISS, INSS, IRRF, PIS, COFINS, CSLL, CP)
- Quando `is_retention = true`, o `assignment_mode` fica automático ("retention_auto") — não precisa selecionar empresas manualmente
- Badge "Retenção" na listagem de obrigações
- Salvar os novos campos no `saveObligation`

## 3. Edge Function — `retention-obligation-generate`

Lógica executada mensalmente (dia 1 às 6h):

1. Buscar obrigações com `is_retention = true`
2. Para cada obrigação, obter o `retention_tax_type`
3. Consultar `invoices` do **mês anterior**, filtrando por **notas tomadas** (onde `issuer_cnpj != cnpj do cliente`)
4. Parsear o XML (`raw_data->xml`) para detectar retenção:
   - ISS: `tpRetISSQN = 2` e `vTotalRet > 0`
   - INSS: `vRetINSS > 0`
   - IRRF: `vRetIRRF > 0`
   - PIS: `vRetPIS > 0`
   - COFINS: `vRetCOFINS > 0`
   - CSLL: `vRetCSLL > 0`
   - CP: `vRetCP > 0`
5. Para cada cliente com retenção detectada, criar `obligation_instance` se ainda não existir para aquele mês
6. Calcular `due_date` usando `due_day` da obrigação + `previousBusinessDay`

### Cron Job (via SQL insert, não migration)
```sql
SELECT cron.schedule('generate-retention-obligations', '0 6 1 * *',
  $$ SELECT net.http_post(url:='...', headers:='...'::jsonb, body:='{}'::jsonb) $$);
```

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx.sql` | Colunas `is_retention`, `retention_tax_type` |
| `src/pages/Obligations.tsx` | UI do flag + badge (~30 linhas) |
| `supabase/functions/retention-obligation-generate/index.ts` | Edge Function (~150 linhas) |
| Cron job via SQL insert | Agendar execução mensal |

## Resultado Esperado
- Admin cadastra obrigação de imposto marcando "É Retenção" + tipo (ex: ISS)
- Todo dia 1, o sistema analisa notas de serviços **tomados** do mês anterior
- Se o cliente teve ISS retido como tomador, gera automaticamente a instância da obrigação (ex: Declaração de Serviços Tomados)

