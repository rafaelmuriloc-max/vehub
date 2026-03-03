

## Plano: Campos adicionais na aba Geral

### Novas colunas na tabela `clients`
Migration para adicionar:
- `opening_date` (date) — data de abertura da empresa (preenchida automaticamente pela busca do CNPJ via campo `data_inicio_atividade`)
- `from_another_office` (boolean, default false) — se o cliente veio de outro escritório
- `previous_office_name` (text) — nome do escritório anterior
- `exit_reason` (text) — motivo da saída: `office_change`, `company_closure`, `mei_change`
- `destination_office_name` (text) — escritório de destino (quando motivo = troca de escritório)
- `exit_reason_notes` (text) — motivo detalhado da troca de escritório

### Alterações em `src/pages/Clients.tsx`

**Form state / emptyForm / Client type / openEdit / handleSave:**
- Incluir os 5 novos campos

**Busca CNPJ (`fetchCnpjData`):**
- Preencher `opening_date` com `data.data_inicio_atividade` (já existe como `foundation_date`, mas este será o campo específico na aba Geral)

**Aba Geral — novos campos após "Data Saída":**
1. **Data de Abertura** — input date, preenchido pela busca CNPJ
2. **Veio de outro escritório?** — checkbox; ao marcar, exibe campo "Nome do escritório anterior"
3. **Quando `end_date` preenchida** — exibe select com motivo da saída:
   - "Troca de escritório" → exibe campos adicionais: nome do escritório destino + motivo da troca
   - "Fechamento da empresa"
   - "Mudança para MEI"

### Lógica condicional na UI
- `from_another_office === true` → mostra input `previous_office_name`
- `end_date` preenchida → mostra select `exit_reason`
- `exit_reason === 'office_change'` → mostra `destination_office_name` + `exit_reason_notes`

