## Objetivo

Adicionar ao cadastro do Agente de IA (aba Empresa → Triagem) um modo de "transferência direta" com **departamento padrão** e **usuário padrão**. Quando ligado, toda nova conversa é encaminhada imediatamente para esse depto+usuário, sem passar pela decisão da IA.

## 1. Banco — `company_settings`

Adicionar três colunas (migration):
- `triage_direct_route_enabled boolean not null default false`
- `triage_direct_route_department_id uuid` (nullable)
- `triage_direct_route_user_id uuid` (nullable; referencia `auth.users`/`profiles.user_id`)

## 2. UI — `src/components/settings/CompanyTab.tsx`

Logo abaixo do bloco "Departamento padrão (fallback)", adicionar uma nova seção:

- **Switch** "Transferir toda nova conversa direto para um atendente" (controla `triage_direct_route_enabled`).
- **Select** "Departamento de destino" — lista de departments.
- **Select** "Atendente padrão" — carrega `profiles` filtrados por `department_id = departamento selecionado` (atualiza ao trocar o depto; limpa se o usuário não pertencer mais ao depto).
- Texto de ajuda: "Quando ligado, a Gisele não usa IA: toda nova conversa é atribuída imediatamente a este atendente, com uma mensagem cordial de transferência."

Validação no `save()`: se `triage_direct_route_enabled = true`, exigir `department_id` e `user_id` preenchidos (toast de erro caso contrário). Persistir os três novos campos no upsert.

## 3. Edge function — `supabase/functions/chat-triage-agent/index.ts`

Após o "claim" e antes do bloco de carregar departamentos/IA:

```ts
const directEnabled = settings.triage_direct_route_enabled;
const directDept = settings.triage_direct_route_department_id;
const directUser = settings.triage_direct_route_user_id;
if (directEnabled && directDept && directUser) {
  // buscar nome do depto
  // update conversation: triage_status='done', triage_department_id, triaged_department_id,
  //                      assigned_to=directUser, triage_summary='Roteamento direto'
  // enviar mensagem cordial via whatsapp-send-text:
  //   "Olá! Vou transferir você para o nosso *{deptName}*. Em instantes {firstName} continuará por aqui. 😊"
  // registrar triage_learnings com outcome='auto_confirmed'
  return ok;
}
```

Manter o fluxo de IA atual como fallback quando o modo direto estiver desligado ou mal configurado.

## 4. Liberar conversas presas (uma vez, após deploy)

As conversas em `triage_status in ('in_progress','pending')` sem `assigned_to` ficaram travadas. Após o deploy, rodar um UPDATE marcando `triage_status='pending'` para que o próximo evento do webhook as processe pelo novo caminho.

## Observação

Hoje o departamento "Sucesso do Cliente" não tem nenhum profile vinculado. Para usar esse modo apontando para ele, preciso que você indique qual usuário deve ser o atendente padrão (ou eu vinculo um profile existente ao departamento, se preferir).
