# Trocar ícones dos badges de situação fiscal

## Objetivo
Substituir os ícones atuais dos badges "Com pendência" e "Regular" na tabela de Situação Fiscal por ícones em estilo checkbox arredondado, conforme a imagem de referência enviada: X vermelho em negrito para pendências e check verde em negrito para regulares.

## O que será alterado
- Arquivo: `src/components/integra-contador/SituacaoFiscalTab.tsx`
- Função `statusBadge` (linhas ~607-625)
- Ícones importados do `lucide-react`

## Mudanças técnicas
1. Adicionar imports `SquareX` e `SquareCheck` do `lucide-react`.
2. No badge `regular`:
   - Trocar `CheckCircle2` por `SquareCheck`.
   - Aplicar cor verde (`text-emerald-600` / `bg-emerald-50` ou similar) e stroke mais grosso (`strokeWidth={2.5}`) para ficar em negrito.
3. No badge `irregular`:
   - Trocar `XCircle` por `SquareX`.
   - Aplicar cor vermelha (`text-red-600` / `bg-red-50` ou similar) e stroke mais grosso.
4. Manter os textos "Regular" e "Com pendência" e os demais badges inalterados.

## Critérios de aceitação
- Badge "Regular" exibe ícone de check verde em negrito dentro de quadrado arredondado.
- Badge "Com pendência" exibe ícone de X vermelho em negrito dentro de quadrado arredondado.
- Typecheck e build passam sem erros.
