## Mudança visual nas abas (Chat / Espera / Geral)

Aplicar um estilo moderno na aba selecionada em `src/components/chat/ConversationList.tsx`:

- **Aba ativa**: fundo branco com borda inferior azul (`border-b-2 border-primary`), texto azul/escuro em negrito, sombra suave
- **Indicador de seta**: pequeno triângulo azul apontando para baixo, centralizado abaixo da aba ativa (via pseudo-elemento `after:` com rotação 45° + fundo primary)
- **Abas inativas**: texto cinza, sem borda, hover suave
- **TabsList**: fundo transparente para destacar a aba ativa

### Implementação

Sobrescrever as classes de cada `TabsTrigger` usando modificadores `data-[state=active]:` do Radix:

```tsx
<TabsList className="w-full bg-transparent border-b border-border/40 rounded-none h-auto p-0 gap-1">
  <TabsTrigger
    value="..."
    className="flex-1 text-sm relative rounded-none border-b-2 border-transparent
               data-[state=active]:border-primary data-[state=active]:bg-background
               data-[state=active]:text-primary data-[state=active]:font-semibold
               data-[state=active]:shadow-sm
               data-[state=active]:after:content-[''] data-[state=active]:after:absolute
               data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2
               data-[state=active]:after:-bottom-[5px] data-[state=active]:after:w-2
               data-[state=active]:after:h-2 data-[state=active]:after:rotate-45
               data-[state=active]:after:bg-primary
               transition-all"
  >
```

Aplicado nas três abas: `mine` (Chat), `in_progress` (Espera) e `all` (Geral). Mantém os badges de contagem existentes.

Nenhuma mudança em lógica, apenas classes Tailwind usando tokens semânticos (`primary`, `background`, `border`).
