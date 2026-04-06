

# Cron job semanal de alerta de certificados via WhatsApp

## O que será feito
Criar uma Edge Function `cert-expiry-alert` que é executada toda segunda-feira às 9h (horário de Brasília) via pg_cron. Ela consulta os certificados vencidos e os que vencem na semana corrente, monta uma mensagem formatada e envia via Evolution API (WhatsApp) para o telefone do responsável cadastrado em `company_settings.cert_responsible_phone`.

## 1. Edge Function `cert-expiry-alert`

Lógica:
1. Buscar `cert_responsible_phone` e `cert_responsible_name` de `company_settings`
2. Buscar clientes ativos com `digital_certificate_expiry`:
   - **Vencidos**: `expiry < hoje`
   - **Vencem esta semana**: `expiry >= hoje AND expiry <= domingo da semana`
3. Montar mensagem formatada:
```text
📋 *Relatório Semanal de Certificados Digitais*

🔴 *Certificados Vencidos*
• Empresa ABC - Vencimento: 15/03/2026
• Empresa XYZ - Vencimento: 01/04/2026

⚠️ *Certificados que vencem esta semana*
• Empresa DEF - Vencimento: 08/04/2026

_Enviado automaticamente toda segunda-feira_
```
4. Enviar via Evolution API (`/message/sendText`) para o telefone do responsável
5. Se não houver certificados em nenhuma categoria, não envia mensagem

## 2. Configuração do pg_cron

Agendar chamada HTTP POST para a Edge Function toda segunda-feira às 9h (12:00 UTC, considerando UTC-3):
```sql
SELECT cron.schedule(
  'cert-expiry-weekly-alert',
  '0 12 * * 1',
  $$ SELECT net.http_post(...) $$
);
```

## 3. Registro em `supabase/config.toml`
Adicionar `[functions.cert-expiry-alert]` com `verify_jwt = false`.

## Arquivos
- `supabase/functions/cert-expiry-alert/index.ts` — nova Edge Function
- `supabase/config.toml` — registro da função

