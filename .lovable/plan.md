

# Corrigir duplicatas de contato por formato de telefone (8 vs 9 dígitos)

## Problema
Existem **28 pares de conversas duplicadas** no chat. A causa: o webhook da EvolutionAPI envia o telefone no formato antigo (8 dígitos, ex: `554796288079`), enquanto o envio automático via Meta API usa o formato com 9 dígitos (`5547996288079`). Como a busca é por igualdade exata, o sistema cria uma conversa nova em vez de reutilizar a existente.

Exemplos:
- "Thiago Talho Terra E Mar" (`554796288079`) = "TALHO TERRA E MAR" (`5547996288079`)
- "Ianara" (`554799432919`) = "IANARA CAROLINE PESCADOS" (`5547999432919`)
- "Alecsandro Thiago" (`554797129090`) = "ALECSANDRO THIAGO ACADEMIA" (`5547997129090`)

## Solução em 3 etapas

### Etapa 1 — Normalização de telefone nas Edge Functions

Adicionar função auxiliar `normalizePhone` e `getPhoneVariants` em ambas as functions:

**`whatsapp-send/index.ts`**: Na busca por conversa existente (linha 136-142), buscar por todas as variantes do telefone usando `.in("whatsapp_phone", variants)` em vez de `.eq("whatsapp_phone", cleanPhone)`. Ao criar conversa nova, salvar o telefone normalizado (13 dígitos).

**`whatsapp-webhook/index.ts`**: Na busca por conversa existente (linha 209-215), aplicar a mesma lógica de variantes. Quando encontrar conversa com telefone no formato antigo, atualizar para o formato canônico.

Lógica de normalização:
- Se o número tem 12 dígitos e o 5º dígito é 6-9, inserir um "9" na posição 5 para gerar o formato de 13 dígitos
- Variantes: formato original + formato normalizado + formato sem o 9º dígito

### Etapa 2 — Consolidar duplicatas existentes no banco

Executar operação de dados que para cada par duplicado:
1. Elege a conversa com status "open" (ou mais mensagens) como principal
2. Move todas as `chat_messages` das duplicatas para a principal
3. Move `chat_participants` sem duplicar
4. Atualiza `whatsapp_phone` da principal para o formato canônico (13 dígitos)
5. Remove as conversas duplicadas

### Etapa 3 — Deploy das functions atualizadas

## Arquivos alterados
- `supabase/functions/whatsapp-send/index.ts` — busca por variantes de telefone (~15 linhas)
- `supabase/functions/whatsapp-webhook/index.ts` — busca por variantes de telefone (~15 linhas)
- Operação de consolidação de dados (28 pares)

