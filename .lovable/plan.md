

## Plano: Módulo de Gestão de Notas Fiscais de Serviço (NFS-e)

### Contexto
O sistema já armazena certificados digitais A1 (.pfx) dos clientes no bucket `certificates` do Supabase Storage, com senha em `digital_certificate_password`. A API Nacional NFS-e usa autenticação via certificado digital para consultas.

### Arquitetura

```text
Frontend (página /invoices)
  │
  ▼
Edge Function "nfse-query"
  │ (recebe clientId, período)
  │ busca certificado do cliente no Storage
  │ autentica na API Nacional NFS-e
  ▼
API Nacional NFS-e (nfse.fazenda.gov.br)
  │ retorna XML das notas
  ▼
Salva no banco + Storage (XML/PDF)
```

### Banco de dados

**Nova tabela `invoices`**:
- `id` uuid PK
- `client_id` uuid FK→clients
- `access_key` text (chave de acesso da NFS-e, unique)
- `invoice_number` text
- `issue_date` date
- `service_description` text
- `gross_value` numeric
- `tax_value` numeric
- `net_value` numeric
- `status` text (normal, cancelada, substituída)
- `xml_url` text (arquivo no Storage)
- `pdf_url` text (arquivo no Storage)
- `issuer_cnpj` text
- `taker_cnpj` text
- `municipality_code` text
- `raw_data` jsonb (dados brutos da API)
- `created_at`, `updated_at` timestamps

RLS: admin gerencia, authenticated visualiza.

**Storage**: Usar bucket `documents` existente com pasta `nfse/` para XMLs e PDFs.

### Edge Function `nfse-query`

1. Recebe `client_id` e `reference_month`
2. Busca o certificado A1 (.pfx) e senha do cliente no banco
3. Faz download do certificado do Storage
4. Usa o certificado para autenticar na API Nacional NFS-e (endpoint de Distribuição de NFS-e - DFe)
5. Consulta notas emitidas/recebidas pelo CNPJ no período
6. Para cada nota: salva XML no Storage, extrai dados e insere/atualiza na tabela `invoices`
7. Retorna lista de notas encontradas

**Nota técnica**: A API Nacional NFS-e requer mTLS (mutual TLS) com certificado A1. No Deno (Edge Functions), isso é suportado via `Deno.connectTls` com `certChain` e `privateKey` extraídos do .pfx. O certificado será parseado com a lib `pkijs` ou similar disponível no Deno.

### Frontend

**Nova página `src/pages/Invoices.tsx`**:
- Seleção de cliente e período (mês/ano)
- Botão "Buscar Notas" que chama a edge function
- Tabela listando notas com: número, data, descrição, valor, status
- Botões de download XML e PDF para cada nota
- Indicador de loading durante busca

**Sidebar**: Adicionar "Notas Fiscais" no menu principal com ícone `Receipt`.

**Rota**: `/invoices` em `App.tsx`.

### Alterações

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `invoices` com RLS |
| `supabase/functions/nfse-query/index.ts` | Edge function para consulta na API Nacional |
| `src/pages/Invoices.tsx` | Nova página de gestão de NFS-e |
| `src/components/AppSidebar.tsx` | Adicionar "Notas Fiscais" no menu |
| `src/App.tsx` | Adicionar rota `/invoices` |

### Limitações conhecidas
- A API Nacional NFS-e pode ter restrições de acesso por ambiente (homologação vs produção)
- Nem todos os municípios estão integrados ao padrão nacional ainda
- A geração de PDF pode depender do layout disponibilizado pela API (DANFSE)

