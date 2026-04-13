

# Aba "Situação Fiscal" separada no Integra Contador

## Visão geral

Criar uma aba dedicada para Situação Fiscal dentro da página Integra Contador, com:
- Tabela listando todos os clientes (com certificado digital)
- Colunas: Nome, Situação (Regular/Irregular), Data última consulta, Ações
- Botão "Consultar em Lote" para processar todos os clientes sequencialmente
- Botões individuais: Consultar, Visualizar PDF, Baixar PDF

## Nova tabela no Supabase

Criar `sitfis_results` para persistir os resultados:

```sql
create table public.sitfis_results (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  status text not null default 'pending', -- 'regular', 'irregular', 'pending', 'error'
  consulted_at timestamp with time zone not null default now(),
  pdf_base64 text,
  raw_response jsonb,
  error_message text,
  unique(client_id)
);

alter table public.sitfis_results enable row level security;

create policy "Authenticated can view" on public.sitfis_results
  for select to authenticated using (true);

create policy "Admins can manage" on public.sitfis_results
  for all to authenticated using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));
```

## Mudanças em arquivos

### `src/pages/IntegraContador.tsx`

1. Adicionar uma aba de nível superior ao componente: "Serviços" (conteúdo atual) e "Situação Fiscal" (nova)
2. A aba "Situação Fiscal" será um componente separado importado

### `src/components/integra-contador/SituacaoFiscalTab.tsx` (novo)

Componente com:
- Carrega clientes com certificado + resultados de `sitfis_results` via join
- Tabela com colunas: checkbox, Razão Social, CNPJ/CPF, Situação (badge colorido), Consultado em, Ação
- Badge "Regular" (verde) / "Irregular" (vermelho) / "Pendente" (cinza)
- Botão "Consultar em Lote" no topo — itera clientes selecionados, chama o fluxo SITFIS existente (etapa 1 + etapa 2), e faz upsert do resultado em `sitfis_results`
- Botões de ação por linha:
  - Consultar (RefreshCw) — executa SITFIS individual
  - Visualizar (Eye) — abre PDF em nova aba via data URL
  - Baixar (Download) — download do PDF
- Busca por CNPJ/Razão social
- Filtro por situação

### `supabase/functions/integra-contador/index.ts`

Ajustar para, ao completar `RELATORIOSITFIS92` com sucesso, fazer upsert em `sitfis_results` com o PDF base64, status extraído da resposta, e timestamp. Isso garante que os dados ficam persistidos mesmo se chamado via lote.

## Arquivos

| Arquivo | Mudança |
|---------|--------|
| `supabase/migrations/xxx_create_sitfis_results.sql` | Nova tabela `sitfis_results` |
| `src/components/integra-contador/SituacaoFiscalTab.tsx` | Novo componente da aba |
| `src/pages/IntegraContador.tsx` | Adicionar tabs de nível superior e importar nova aba |
| `supabase/functions/integra-contador/index.ts` | Upsert em `sitfis_results` após RELATORIOSITFIS92 |

