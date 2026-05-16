## Objetivo
Fazer com que o leitor do e-mail (corpo) ocupe verticalmente até a base da tela, sem cortar antes.

## Causa
O container raiz da página usa `h-[calc(100vh-6rem)]`, que reserva 6rem para um header inexistente nesta tela e ainda sofre com a barra de URL móvel (100vh). Resultado: a base do iframe do corpo do e-mail fica acima da borda inferior da tela.

## Mudança (somente `src/pages/Email.tsx`)

1. Trocar o wrapper raiz de:
   ```
   <div className="flex h-[calc(100vh-6rem)] -m-4 md:-m-6 bg-background">
   ```
   para:
   ```
   <div className="flex h-[100dvh] -m-4 md:-m-6 bg-background">
   ```
   - `100dvh` se ajusta corretamente em mobile (barra dinâmica do navegador).
   - Os `-m-4/-m-6` continuam neutralizando o padding do layout, então a página ocupa a altura total real.

2. Garantir `min-h-0` na coluna principal (`<main>`) para que o flex interno (toolbar + lista/leitor) calcule corretamente o `flex-1` do iframe.

Nenhuma outra alteração de comportamento, dados ou estilo é necessária. A lista de e-mails herdará o mesmo ganho de altura.

## Validação
- Abrir um e-mail em desktop (1267x754): o iframe do corpo deve encostar na borda inferior, com a barra de anexos (quando houver) ancorada acima da base.
- Em mobile: sem corte com a barra do navegador recolhida ou expandida.