

## Plano: Abas no Cadastro de Cliente

### Visão Geral
Transformar o formulário de cadastro/edição de cliente em um dialog com abas, adicionando campos específicos para cada área do escritório contábil.

### 1. Novos campos no banco (Migration)

Adicionar colunas à tabela `clients`:

**Fiscal:**
- `tax_regime` (text) — Regime tributário (Simples Nacional, Lucro Presumido, Lucro Real, MEI)
- `main_activity` (text) — Atividade principal (CNAE)
- `secondary_activities` (text) — Atividades secundárias
- `state_registration` (text) — Inscrição estadual
- `municipal_registration` (text) — Inscrição municipal

**Pessoal:**
- `payroll_type` (text) — Tipo de folha (Normal, Pró-labore apenas, Sem folha)
- `employee_count` (integer, default 0) — Quantidade de funcionários
- `payroll_notes` (text) — Observações sobre folha

**Societário:**
- `permits` (text) — Alvarás (descrição livre ou JSON)
- `digital_certificate_expiry` (date) — Vencimento do certificado digital
- `digital_certificate_type` (text) — Tipo (A1, A3)
- `partners_info` (text) — Informações dos sócios da empresa cliente

**Sucesso do Cliente:**
- `company_description` (text) — Descrição da empresa
- `business_segment` (text) — Segmento de atuação
- `foundation_date` (date) — Data de fundação
- `success_notes` (text) — Observações sobre a empresa e sócios

### 2. Reformular o Dialog de Cliente

Substituir o formulário atual por um com **Tabs** (5 abas):

- **Geral** — campos existentes (razão social, CNPJ, contato, endereço, valor, status, datas)
- **Fiscal** — regime tributário (select), atividade, inscrições
- **Pessoal** — tipo de folha (select), qtd funcionários, observações
- **Societário** — alvarás, certificado digital (tipo + vencimento), info sócios
- **Sucesso do Cliente** — descrição da empresa, segmento, fundação, observações

O dialog será ampliado (`max-w-2xl`) para acomodar as abas.

### 3. Detalhes Técnicos
- Todos os novos campos são nullable, sem impacto nos registros existentes
- O form state será expandido com os novos campos
- O payload de save incluirá todos os campos das abas
- Componente permanece em `src/pages/Clients.tsx` (refatorado)

