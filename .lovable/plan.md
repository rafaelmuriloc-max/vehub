## Objetivo

Reduzir custo de IA e acelerar a importação. O usuário define o **contexto** antes do upload; à IA cabe apenas identificar a **empresa (CNPJ)** e, quando mais de um tipo for permitido, **escolher qual tipo** entre os pré-selecionados.

## Novo fluxo de pré-seleção (em ordem)

Diálogo aberto ao clicar em "Importar" — `ImportSetupDialog`:

1. **Departamento** (Select) — lista de `departments`. Respeita o departamento do usuário (employee vê só o seu).
2. **Competência** (input month).
3. **Obrigação** (Combobox) — `obligations` filtradas por `department_id` e pela `competence_rule`/recorrência aplicável à competência escolhida.
4. **Tipo(s) de documento** (multi-select com checkboxes) — pré-carrega todos os `document_types` vinculados às `obligation_activities` (tipo `document`) daquela obrigação. Por padrão **todos vêm marcados**; o usuário pode desmarcar. Quando a obrigação tem só um tipo, o multi-select aparece já travado nesse único item. Quando não houver tipos cadastrados, fallback para Combobox aberto contra todos os `document_types`.

Após confirmar, o usuário escolhe N arquivos.

## Lógica por arquivo

Contexto fixo: `departmentId`, `referenceMonth`, `obligationId`, `allowedDocTypeIds[]`.

1. **Identificar empresa**:
   - Regiões configuradas (`extraction_config.cnpj_region`) → CNPJ.
   - Fallback regex local sobre o texto do PDF.
   - Fallback IA enxuta (`classify-document` modo `cnpj_only`) — só pede o CNPJ.
2. **Escolher tipo de documento**:
   - Se `allowedDocTypeIds.length === 1` → usa direto, **zero IA**.
   - Se > 1 → tenta casar pelo nome via regiões/texto (`extractTextFromCachedRegion` + match com `name` dos tipos permitidos). Se falhar, chama `classify-document` modo `pick_doctype` passando **apenas os nomes dos tipos permitidos** (lista curta = prompt curto).
3. Importa: grava `documents` com `client_id`, `document_type_id`, `reference_month`, e `linked_obligation_id` = obrigação escolhida. Cria/usa a `obligation_instance` daquela competência.
4. Se empresa não casar OU tipo não puder ser decidido → `DocumentReviewDialog` simplificado pedindo só o que faltou (empresa e/ou tipo), com competência/obrigação já travadas.

## Mudanças técnicas

**Frontend**
- `src/pages/Documents.tsx`
  - Botão "Importar" abre `ImportSetupDialog` antes do file picker.
  - Novo estado `importContext: { departmentId, referenceMonth, obligationId, allowedDocTypeIds[] }`.
  - `handleUpload` consome esse contexto; remove dedução de tipo/competência no caminho feliz.
  - `importDocument` recebe `obligationId` e grava `linked_obligation_id` direto (auto-associate por activity vira fallback).
- Novo `src/components/documents/ImportSetupDialog.tsx`
  - Carrega `departments`, `obligations`, `obligation_activities` (com `document_type_id`) e `document_types`.
  - Etapas 1→4 em uma única tela (Selects empilhados) com validação progressiva: campo só habilita após o anterior estar preenchido.
  - Multi-select de tipos com "Selecionar todos / Limpar".
- `src/components/DocumentReviewDialog.tsx`
  - Aceitar props `lockedReferenceMonth`, `lockedObligationId`, e `allowedDocTypeIds` (filtra o Select de tipo); oculta campos travados.

**Edge Function**
- `supabase/functions/classify-document/index.ts`
  - Modos novos: `cnpj_only` (retorna `{ cnpj }`) e `pick_doctype` (recebe lista curta de nomes e retorna `{ document_type_name }`).
  - Mantém modo completo para compatibilidade.

**Banco** — sem alterações de schema.

## Fora de escopo

- Tela de Tipos de Documento e anotador de regiões permanecem inalterados.
- Importação por chat/email não muda.
