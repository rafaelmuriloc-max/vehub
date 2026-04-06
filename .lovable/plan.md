

# Melhorar layout dos cards de retenções

## Problema atual
Os cards de retenção usam um grid `grid-cols-2 md:grid-cols-4 lg:grid-cols-8` que fica apertado, com cards pequenos e texto truncado (como visível na screenshot). O card "Total Retido" tem destaque mas compete visualmente com os demais no mesmo grid.

## Novo layout proposto

Inspirado na screenshot do usuário, reorganizar os cards de retenção com mais espaço e hierarquia visual:

### Estrutura para cada seção (Prestados e Tomados)

1. **Card "Total Retido"** — destaque maior, ocupa largura cheia ou metade, com background colorido mais pronunciado e valor em tamanho maior
2. **Cards individuais de impostos** — grid `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` com cards maiores, mais padding, texto legível
3. Mostrar todos os impostos com valor > 0 sem compressão excessiva
4. Remover `col-span-2 md:col-span-1` do "Total Retido" — dar uma linha separada ou posição de destaque

### Detalhes visuais

**Card "Total Retido":**
- Background mais forte (blue-100/orange-100)
- Badge colorido com label "Total Retido"
- Valor em `text-2xl font-bold`
- Borda left 3px colorida (como padrão do projeto em obligations)

**Cards de impostos individuais:**
- Grid `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6` — mais flexível
- Padding `pt-5 pb-4 px-5`
- Label em `text-xs uppercase tracking-wide`
- Valor em `text-xl font-bold`
- Borda sutil colorida (blue/orange 200)

**Layout geral da seção de retenção:**
- Flex row: "Total Retido" card à esquerda + grid de impostos à direita
- Ou: "Total Retido" em linha separada acima + grid de impostos abaixo
- Separação visual com `mt-2` e label "Impostos Retidos" mais destacado

## Alterações
- `src/components/invoices/NfseTab.tsx` — linhas 487-509 (prestados) e 538-560 (tomados): redesenhar o bloco de retenções com novo grid e hierarquia visual

