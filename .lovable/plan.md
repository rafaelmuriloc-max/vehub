

# Acionar atividades automáticas após upload de documentos

## Problema
A página de Documentos (`Documents.tsx`) marca a atividade de documento como concluída ao importar, mas não executa a cadeia de `auto_start` (e-mail/WhatsApp). Essa lógica só existe no `ClientObligationsTab` e `CalendarView`.

## Solução
Após marcar cada atividade de documento como concluída na função `importDocument`, executar a mesma lógica de cadeia automática: buscar as atividades seguintes da obrigação, e para cada uma com `auto_start = true`, disparar e-mail ou WhatsApp conforme o tipo.

## Alterações em `src/pages/Documents.tsx`

### 1. Importar funções de envio
Adicionar imports de `sendActivityEmail` e `sendActivityWhatsApp`.

### 2. Após o loop de completions (linha ~288), adicionar lógica auto_start
Para cada instância processada:
- Buscar todas as atividades da obrigação, ordenadas por `order`
- Encontrar a posição da atividade de documento recém-completada
- Percorrer as atividades seguintes com `auto_start = true`
- Para tipo `email`: chamar `sendActivityEmail`
- Para tipo `whatsapp`: chamar `sendActivityWhatsApp`
- Parar na primeira falha ou atividade sem `auto_start`

A lógica é idêntica à já existente em `ClientObligationsTab.tsx` (linhas 232-285).

### 3. Buscar dados necessários
Para montar os parâmetros das funções de envio, buscar:
- Nome da obrigação (já temos o `obligation_id`)
- `reference_month` e `due_day` da instância/obrigação
- `department_id` da obrigação
- Todas as atividades da obrigação com seus campos de email/WhatsApp

## Arquivos
- `src/pages/Documents.tsx`

