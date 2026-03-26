

# Reprocessar sincronização completa com a nova planilha

## Problema
A migração anterior usou dados parciais/incorretos — continha CNPJs que não existem na planilha (ex: códigos SCI 185-248 com CNPJs diferentes) e faltavam ~30 clientes da planilha. Resultado: 160 clientes no sistema em vez de 191.

## Planilha atual
- **Page 1**: 186 clientes (linhas 9-194, códigos SCI 3 a 255)
- **Page 2**: 5 clientes adicionais (códigos SCI 191, 192, 193, 124, 12)
- **Total**: 191 clientes únicos (por CNPJ)
- 1 cliente com status "Inativa" (LUNNAR, código 193)

## Plano

### 1. Script Python para extrair todos os CNPJs da planilha
- Ler o arquivo Excel com pandas
- Extrair todas as 191 linhas com CNPJ, razão social, nome fantasia, regime, honorário, código SCI, segmento, status
- Normalizar CNPJs (remover pontuação)
- Converter honorários (formato BR com vírgula → numérico)
- Mapear regimes: "SIMPLES NACIONAL" → `simples_nacional`, "LUCRO PRESUMIDO" → `lucro_presumido`, "MEI" → `mei`

### 2. Comparar com base atual
- Consultar via psql todos os CNPJs atuais no sistema
- Identificar: quais faltam, quais são extras, quais precisam de update

### 3. Gerar e executar migração SQL
Uma única migração que:
- **UPDATE** todos os 191 clientes da planilha (tax_regime, monthly_value, sci_code, trade_name, status, business_classification onde vazio)
- **DELETE** clientes que não estão na planilha
- **INSERT** clientes novos que estão na planilha mas não no sistema

### Detalhes técnicos
- Usar `code--exec` com Python + pandas para ler o Excel e gerar o SQL
- Executar as operações via migration SQL (pois psql só tem SELECT/INSERT)
- Manter a lógica de não sobrescrever `business_classification` se já preenchido
- Trade names da planilha: coluna "Nome Fantasia"
- Page 2 tem dados extras (cidade, UF, etc.) que não precisamos agora

