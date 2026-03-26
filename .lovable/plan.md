

# Busca em lote de CNPJs para atualizar todos os cadastros

## Objetivo
Criar uma funcionalidade que percorre todos os clientes com CNPJ, consulta a edge function `cnpj-lookup` para cada um, e atualiza os campos cadastrais (razão social, endereço, telefone, CNAE principal, CNAEs secundários, sócios, regime tributário, nome fantasia, data de abertura, segmento e classificação por IA).

## Mudanças

### 1. Adicionar botão "Atualizar Cadastros via CNPJ" na página de Clientes
- Botão visível na barra de ações da listagem de clientes
- Ao clicar, inicia o processo em lote com indicador de progresso (ex: "Atualizando 15/187...")
- Delay de 1.5s entre cada requisição para não sobrecarregar a API

### 2. Lógica de atualização em lote (`src/pages/Clients.tsx`)
- Buscar todos os clientes com CNPJ válido (14 dígitos)
- Para cada cliente:
  - Chamar `supabase.functions.invoke('cnpj-lookup', { body: { cnpj } })`
  - Montar os campos: `company_name`, `address`, `contact_phone`, `contact_email`, `main_activity`, `secondary_activities`, `tax_regime`, `partners_info`, `foundation_date`, `opening_date`, `business_segment`, `trade_name`
  - Chamar `classify-segment` para obter `business_classification` via IA
  - Fazer `UPDATE` no Supabase com os dados obtidos
- Exibir toast com resumo ao final (X atualizados, Y erros)

### 3. Proteções
- Botão desabilitado durante execução
- Não sobrescrever `monthly_value`, `sci_code`, `status` ou outros campos manuais
- Se a API falhar para um CNPJ, pular e continuar com o próximo
- Preservar `business_classification` se já existir (ou atualizar sempre, a pedido do usuário)

### Detalhes técnicos
- Reutiliza a mesma lógica de `fetchCnpjData` já existente, mas aplicada em lote
- Delay de 1500ms entre chamadas para respeitar rate limits da BrasilAPI
- Progresso mostrado via estado React (contador atual / total)
- Ao finalizar, recarrega a lista de clientes

