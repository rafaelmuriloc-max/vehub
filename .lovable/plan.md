

# Melhorar layout do calendário no mobile

## Problemas atuais (viewport 402px)

1. **Grid do calendário**: 7 colunas com `min-h-[100px]` — cada célula fica ~50px de largura, texto das obrigações ilegível e cells enormes
2. **Header da página**: título "Calendário" + subtítulo + botão limpar filtros não cabem em linha
3. **Filtros**: grid 3 colunas que já empilha (ok), mas popover de empresa com `w-[320px]` pode estourar
4. **Legenda**: inline pode quebrar mal
5. **Weekday headers**: uppercase com tracking-wider não cabe

## Solução — apenas CSS/classes, sem alterar lógica

### 1. Header da página
- Título menor no mobile: `text-xl md:text-2xl`
- Subtítulo oculta no mobile: `hidden md:block`
- Botão limpar filtros: empilhar abaixo no mobile com `flex-col md:flex-row`

### 2. Grid do calendário — modo compacto no mobile
- Cells: `min-h-[48px] md:min-h-[100px]` — no mobile mostra apenas o número do dia + dots coloridos (sem texto de obrigação)
- Ocultar nomes de obrigações dentro das cells no mobile: `hidden md:flex` no container de texto
- Mostrar apenas dots (bolinhas coloridas) no mobile: `flex md:hidden` para um row de dots
- Weekday labels: `text-[10px] md:text-xs`, remover `tracking-wider` no mobile

### 3. Popover de empresa
- Largura responsiva: `w-[calc(100vw-2rem)] md:w-[320px]`

### 4. Legenda
- `flex-wrap` para quebrar em mobile se necessário
- `gap-3 md:gap-5`, `text-[10px] md:text-xs`

### 5. Seção "Obrigações do dia"
- Já empilha corretamente (flex-col), sem alteração necessária

## Arquivo
- `src/pages/CalendarView.tsx` (~15 linhas de classes CSS alteradas, nenhuma lógica modificada)

