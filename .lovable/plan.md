## Ajustar separador entre conversas no mobile (estilo iOS/WhatsApp)

Hoje cada item da lista usa `border-b border-border/30` + `shadow-sm border-dashed`, ocupando toda a largura do card e gerando uma linha "pesada" sob o avatar.

A referência (print do iPhone) mostra um divisor fino que **começa após o avatar** (recuado à esquerda) e vai até a borda direita, sem sombra nem tracejado.

### Mudanças em `src/components/chat/ConversationList.tsx`

1. **Botão da conversa** (linha 218): remover `border-b border-border/30 shadow-sm border-dashed` do `<button>`. Manter apenas hover/active.

2. **Divisor recuado**: dentro da `<div class="flex-1 ...">` (após o avatar), adicionar um `<div>` divisor no final do conteúdo OU envolver cada item em um wrapper com pseudo-borda. Solução mais limpa:
   - Trocar o `map` por uma estrutura onde cada item é `<div className="flex items-stretch"> <Avatar/> <div className="flex-1 border-b border-border/60 pb-2.5 md:pb-3"> ... </div> </div>` — assim a borda inferior fica somente na coluna do conteúdo, criando o recuo igual ao print.

3. **Último item sem borda**: usar `last:border-b-0` no wrapper do conteúdo para não desenhar linha após a última conversa.

4. **Cor do divisor**: usar `border-border/60` (mais visível que /30, próximo ao cinza do iOS) sem dashed nem shadow.

5. **Container `mx-[6px]`** (linha 204): manter, mas o recuo do divisor virá do próprio layout, não desse padding.

### Resultado esperado
- Linha fina cinza começando depois do avatar até a borda direita
- Sem sombra, sem traço pontilhado
- Último item sem linha embaixo
- Funciona igual em mobile e desktop

### Arquivos
- `src/components/chat/ConversationList.tsx` (apenas o bloco do `map filtered`)
