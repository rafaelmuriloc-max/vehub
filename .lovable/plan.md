# Controlar certificados apenas de empresas ativas e sem data de saída

## Estado atual (confirmado)

- O painel "Vencimento de Certificados" (página Clientes, `certMonthData` em `src/pages/Clients.tsx` ≈ linha 237) usa a lista completa de clientes (`select('*')` sem filtro de status) e filtra apenas quem tem `digital_certificate_expiry` preenchido — inclui inativos e empresas com data de saída.
- A edge function `cert-expiry-alert` (relatório semanal de WhatsApp) filtra `.eq("status", "active")` mas **não** exclui quem tem `end_date` preenchido.

## O que muda

1. **Painel na página Clientes** (`src/pages/Clients.tsx`)
   - No `useMemo` `certMonthData`: filtrar `withCert` para incluir somente `status === 'active'` **e** `end_date` nulo/vazio.
   - Contadores "Vencidos", "Próx. 15 dias" e "Total" passam a refletir apenas esse conjunto.

2. **Alerta semanal de certificados** (`supabase/functions/cert-expiry-alert/index.ts`)
   - Adicionar `.is("end_date", null)` à consulta de clientes ativos, para que o relatório de WhatsApp também ignore empresas com data de saída.

## Detalhes técnicos

- Apenas filtros em consultas existentes; nenhuma alteração de schema, RLS ou layout.
- Deploy da edge function `cert-expiry-alert` após a alteração.
