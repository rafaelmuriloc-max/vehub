

# Tornar a página de Obrigações responsiva

## Problema
A página de Obrigações tem layout fixo que não se adapta a telas menores: badges ficam aglomerados, tabela de atividades não cabe, dialogs não têm scroll, e o header não empilha.

## Alterações

### `src/pages/Obligations.tsx`

1. **Header** (linhas 167-173): Empilhar título e botão em telas pequenas com `flex-col sm:flex-row` e gap.

2. **Obligation row** (linhas 189-204): Usar `flex-col sm:flex-row` para empilhar nome/badges e botões de ação em mobile. Badges ficam com `flex-wrap`.

3. **Activities table** (linhas 216-260): Envolver a tabela em `div` com `overflow-x-auto` para scroll horizontal em telas pequenas. Esconder colunas menos importantes (Tipo Doc., Descrição) em mobile com `hidden md:table-cell`.

4. **Obligation Dialog** (linhas 272-327): Usar `DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"`. Grid de dias (3 colunas) muda para `grid-cols-1 sm:grid-cols-3`.

5. **Activity Dialog** (linhas 330-424): Adicionar `max-h-[90vh] overflow-y-auto` ao DialogContent para scroll vertical em telas pequenas.

## Detalhes técnicos
- Usa apenas classes Tailwind existentes (responsive prefixes `sm:`, `md:`)
- Nenhuma dependência nova
- Apenas 1 arquivo modificado: `src/pages/Obligations.tsx`

