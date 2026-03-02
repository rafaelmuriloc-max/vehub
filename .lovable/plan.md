

## Plano: Busca automática de dados do cliente pelo CNPJ

### Abordagem
Usar a API pública **BrasilAPI** (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`) para consultar dados da empresa quando o usuário digitar/colar um CNPJ no campo de documento. A API retorna razão social, endereço, telefone, email, atividades CNAE, sócios, etc.

### Implementação

1. **Botão de busca ao lado do campo CNPJ** — ao clicar (ou ao sair do campo com 14 dígitos), dispara a consulta à BrasilAPI.

2. **Preencher automaticamente os campos** com os dados retornados:
   - **Geral**: `company_name` (razão social), `address` (logradouro + número + bairro + município/UF), `contact_phone` (telefone), `contact_email` (email)
   - **Fiscal**: `main_activity` (CNAE principal: código + descrição), `secondary_activities` (CNAEs secundários), `tax_regime` (porte/natureza jurídica como indicativo)
   - **Societário**: `partners_info` (lista de sócios da resposta)
   - **Sucesso**: `foundation_date` (data de abertura), `business_segment` (descrição da atividade principal)

3. **UX**: loading spinner no botão durante a busca, toast de erro se CNPJ inválido ou não encontrado, formatação automática do CNPJ (##.###.###/####-##).

### Detalhes Técnicos
- API pública, sem autenticação, CORS habilitado — chamada direta do frontend
- Sem necessidade de edge function, migration ou secrets
- Apenas alterações em `src/pages/Clients.tsx`

