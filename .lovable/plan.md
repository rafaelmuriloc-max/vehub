

# Plano: Auto-buscar código IBGE do município, buscar tomador por CNPJ e salvar tomadores

## Visão Geral

Três melhorias na tela de emissão de NFS-e:

1. **Código Município Incidência (IBGE)**: preencher automaticamente a partir do endereço do cliente prestador selecionado, usando a BrasilAPI para obter o código IBGE de 7 dígitos via CEP ou nome do município
2. **Busca do Tomador por CNPJ**: ao digitar o CNPJ do tomador e clicar em buscar, consultar a BrasilAPI (`/cnpj/v1/{digits}`) e preencher automaticamente todos os campos (razão social, endereço, telefone, email, código município IBGE, UF, CEP)
3. **Salvar Tomadores**: criar uma tabela `service_takers` no Supabase para persistir tomadores já usados, permitindo reutilização futura via combobox/autocomplete

## Implementação

### 1. Nova tabela `service_takers` (migration SQL)

```sql
create table public.service_takers (
  id uuid primary key default gen_random_uuid(),
  document text not null,
  company_name text not null,
  municipal_registration text,
  email text,
  phone text,
  street text,
  number text,
  neighborhood text,
  municipality_code text,
  uf text,
  zip_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(document)
);

alter table public.service_takers enable row level security;
create policy "Authenticated users can manage takers"
  on public.service_takers for all to authenticated using (true) with check (true);
```

### 2. Editar `src/pages/InvoiceEmit.tsx`

- **Auto-fill IBGE code**: quando `selectedClient` mudar, extrair o CEP do endereço do cliente e consultar `https://brasilapi.com.br/api/cep/v2/{cep}` para obter o `ibge` code (7 dígitos) e preencher `codigoMunicipioIncidencia`
- **Buscar tomador por CNPJ**: adicionar botão de busca ao lado do campo CNPJ do tomador. Ao clicar:
  1. Primeiro verificar na tabela `service_takers` se já existe com esse documento
  2. Se não existir, consultar `https://brasilapi.com.br/api/cnpj/v1/{digits}` e preencher todos os campos
  3. Também consultar `https://brasilapi.com.br/api/cep/v2/{cep}` para obter o código IBGE do município do tomador
- **Salvar tomador**: ao submeter a NFS-e com sucesso, fazer upsert na tabela `service_takers` com os dados do tomador
- **Combobox de tomadores salvos**: adicionar um Select/Combobox acima dos campos do tomador que lista tomadores salvos (`service_takers`), ao selecionar um preenche todos os campos automaticamente

### 3. Regenerar types (automático pelo Supabase)

## Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | Migration SQL para tabela `service_takers` |
| Editar | `src/pages/InvoiceEmit.tsx` — auto-fill IBGE, busca CNPJ tomador, combobox tomadores salvos, upsert ao emitir |

