

# Enviar todos os documentos anexados via WhatsApp

## Problema
Quando há múltiplos documentos anexados, apenas o primeiro é enviado. A API da Meta aceita apenas um documento por header, então basta repetir o envio completo para cada documento.

## Alteração

### `src/lib/sendActivityWhatsApp.ts`

Quando `whatsapp_has_document_header` é `true` e há múltiplos documentos, em vez de montar um único `body` e chamar `whatsapp-send` uma vez, iterar sobre cada documento e enviar uma mensagem completa (header + body + button) para cada um.

**Lógica:**
1. Montar os `components` de body e button uma vez (são iguais para todos)
2. Para cada documento em `attachedDocs`:
   - Gerar signed URL
   - Montar header com o documento atual
   - Concatenar header + body + button nos components
   - Chamar `whatsapp-send`
3. Se `whatsapp_has_document_header` é `false` ou não há documentos, manter o comportamento atual (uma única chamada)
4. Marcar atividade como concluída apenas se todos os envios foram bem-sucedidos

## Arquivos
- `src/lib/sendActivityWhatsApp.ts`

