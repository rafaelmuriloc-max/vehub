

# Inserir os 93 clientes faltantes da planilha

## Problema
A sincronização anterior executou o DELETE (removeu clientes fora da planilha) e os UPDATEs, mas os INSERTs dos clientes novos nunca foram aplicados. Resultado: 98 clientes no sistema em vez de 191.

## Solução

### 1. Extrair dados da planilha
- Ler `user-uploads://01_-_Base_Clientes-2.xlsx` com pandas (Page 1 linhas 9-194 + Page 2)
- Coletar todos os 191 CNPJs com seus dados

### 2. Identificar faltantes
- Consultar CNPJs atuais no banco (98 registros)
- Comparar com os 191 da planilha
- Gerar lista dos ~93 CNPJs ausentes

### 3. Executar INSERTs via migration SQL
- Para cada cliente faltante, gerar INSERT com: `company_name`, `document`, `trade_name`, `tax_regime`, `monthly_value`, `sci_code`, `business_classification` (se disponível na planilha), `status`
- Dividir em batches se necessário para respeitar limites de tamanho da migração

### Detalhes
- Normalizar CNPJs para formato `XX.XXX.XXX/XXXX-XX`
- Converter honorários de formato BR (vírgula) para numérico
- Mapear regimes: SIMPLES NACIONAL → simples_nacional, LUCRO PRESUMIDO → lucro_presumido, MEI → mei
- Status padrão: active (exceto LUNNAR que é Inativa → inactive)

