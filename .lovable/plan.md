

# Sincronizar Base de Clientes com Planilha

## Objetivo
Atualizar a base de clientes no Supabase com os dados da planilha Excel, incluindo: regime tributário, valor mensal, código SCI, nome fantasia, segmento, além de excluir clientes ausentes na planilha e cadastrar novos.

## Mudanças

### 1. Migração SQL — nova coluna `trade_name`
```sql
ALTER TABLE clients ADD COLUMN trade_name text;
```

### 2. Atualizar `src/pages/Clients.tsx`
- Adicionar `trade_name` ao tipo Client, emptyForm, populateForm, handleSave
- Adicionar campo "Nome Fantasia" na aba Geral do formulário (após Razão Social)
- Preencher automaticamente via BrasilAPI no fetchCnpjData

### 3. Script de sincronização de dados (via exec)
Ler a planilha com pandas, extrair as colunas relevantes por CNPJ e executar via psql:

**Para cada linha da planilha:**
- Extrair: CNPJ, Honorário (monthly_value), Segmento (business_classification), Regime Tributação (tax_regime), Código (sci_code), Nome fantasia (trade_name)
- Mapear regime: "SIMPLES NACIONAL", "LUCRO PRESUMIDO", "MEI" → valores usados no sistema

**Operações:**
- **UPDATE** clientes existentes (cruzamento por CNPJ): tax_regime, monthly_value, sci_code, trade_name
- **UPDATE** segmento apenas quando `business_classification` estiver NULL/vazio
- **DELETE** clientes que existem no sistema mas não na planilha
- **INSERT** clientes novos (que estão na planilha mas não no sistema) com: company_name (razão social), document (CNPJ), sci_code, monthly_value, tax_regime, business_classification, trade_name, status

### Mapeamento de colunas (planilha → banco)
| Planilha | Banco |
|---|---|
| Honorário | monthly_value |
| Segmento | business_classification |
| Regime Tributação | tax_regime |
| Código | sci_code |
| Razão social | company_name |
| CNPJ | document |
| Nome fantasia | trade_name |
| Status (Ativa/Inativa) | status (active/inactive) |

### Detalhes técnicos
- Planilha tem ~186 clientes (linhas 9-194)
- CNPJs na planilha incluem formatação (XX.XXX.XXX/XXXX-XX), normalizar para comparação
- Honorários com formato brasileiro (vírgula decimal), converter para numérico
- Usar psql INSERT para novos e UPDATE para existentes (o acesso permite INSERT e SELECT, mas UPDATE precisa migration — usaremos edge function ou faremos via migration com valores hardcoded)
- Como psql só tem SELECT/INSERT, os UPDATEs e DELETEs serão feitos via migration SQL

