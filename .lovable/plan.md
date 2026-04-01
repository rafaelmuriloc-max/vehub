

# Segmentação de empresas, seleção manual e geração de obrigações no cadastro

## O que será feito
Adicionar ao cadastro de obrigações:
1. Campo de segmentação para definir quais empresas terão essa obrigação automaticamente (por folha de pagamento, regime tributário, cidade, etc.)
2. Opção de selecionar empresas manualmente
3. Seção para gerar instâncias de obrigações diretamente do cadastro, escolhendo mês de início até dezembro

## Alterações

### 1. Migration — nova tabela `obligation_segments` e coluna de modo
```sql
-- Modo de vinculação: 'all', 'segment', 'manual'
ALTER TABLE obligations ADD COLUMN assignment_mode text NOT NULL DEFAULT 'manual';

-- Regras de segmentação (filtros)
ALTER TABLE obligations ADD COLUMN segment_filters jsonb DEFAULT '{}';
-- Exemplo: { "has_payroll": true, "tax_regime": ["simples_nacional"], "city": ["São Paulo"] }
```

Usando JSONB para `segment_filters` permite flexibilidade para adicionar novos critérios sem alterar o schema. Exemplos de filtros:
- `has_payroll: true` — empresas com folha (payroll_type não nulo)
- `tax_regime: ["simples_nacional", "lucro_presumido"]` — regimes específicos
- `city: ["São Paulo", "Rio de Janeiro"]` — cidades (extraídas do campo `address`)

### 2. `src/pages/Obligations.tsx` — UI do formulário

**Seção "Empresas vinculadas"** (nova, após os dias):

- **Select "Modo de vinculação"**: Todas / Por segmento / Manual
- **Quando "Por segmento"**:
  - Checkbox "Empresas com Folha de Pagamento"
  - Multi-select "Regime Tributário" (Simples Nacional, Lucro Presumido, Lucro Real, MEI)
  - Input "Cidade" (texto livre ou multi-select com cidades dos clientes existentes)
  - Preview: "X empresas correspondem a este filtro" (query em tempo real)
- **Quando "Manual"**:
  - Lista de clientes com checkboxes para seleção individual
  - Busca por nome/CNPJ
  - Badge mostrando quantidade selecionada

**Seção "Gerar Obrigações"** (nova, após empresas vinculadas, visível ao editar):
- Select "Mês de início" (Janeiro a Dezembro do ano corrente)
- Botão "Gerar Obrigações" que cria `obligation_instances` para as empresas vinculadas (por segmento ou manual), do mês selecionado até dezembro
- Texto informativo: "Serão geradas obrigações de [Mês] a Dezembro/[Ano] para X empresas"

### 3. `src/pages/Obligations.tsx` — Lógica

- `loadAll()`: carregar também `clients` (id, company_name, document, tax_regime, payroll_type, address, status) e `client_department_obligations`
- `getFilteredClients(filters)`: filtra clientes ativos conforme os critérios de segmento
- `saveObligation()`: salvar `assignment_mode` e `segment_filters`; quando "segment", auto-sincronizar `client_department_obligations` com os clientes filtrados; quando "manual", sincronizar com os selecionados
- `generateFromObligation(obligationId, startMonth)`: gerar `obligation_instances` do mês de início até dezembro para todos os clientes vinculados (mesma lógica do `ClientObligationsTab.generateObligations`, mas em lote)

### 4. `src/integrations/supabase/types.ts`
- Será atualizado automaticamente com `assignment_mode` e `segment_filters`

## Fluxo do usuário
1. Cria/edita obrigação → escolhe modo "Por segmento"
2. Marca "Empresas com Folha" e seleciona regime "Simples Nacional"
3. Vê preview "15 empresas correspondem"
4. Salva → sistema vincula automaticamente as 15 empresas na tabela `client_department_obligations`
5. Na seção "Gerar Obrigações", seleciona "Abril" como mês de início
6. Clica "Gerar" → cria instances de Abril a Dezembro para as 15 empresas

## Arquivos
- Migration SQL (nova)
- `src/pages/Obligations.tsx` (formulário + lógica de segmentação/geração)
- `src/integrations/supabase/types.ts` (auto-update)

