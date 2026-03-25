

# Corrigir iframe do Monitor Contabil

## Problema
A Content-Security-Policy (CSP) no `index.html` nao inclui uma diretiva `frame-src`, entao o navegador bloqueia o carregamento do iframe `https://app.monitorcontabil.com.br/` porque o `default-src` e `'self'`.

**Nota importante**: Mesmo corrigindo a CSP do nosso lado, o site `app.monitorcontabil.com.br` pode tambem bloquear ser embutido em iframe atraves do header `X-Frame-Options` ou sua propria CSP `frame-ancestors`. Se isso acontecer, a unica solucao seria abrir o site em uma nova aba.

## Mudanca

### `index.html` (linha 6)
Adicionar `frame-src 'self' https://app.monitorcontabil.com.br https://*.monitorcontabil.com.br;` na meta tag CSP.

### `src/pages/Fiscal.tsx`
Adicionar um botao/link de fallback para abrir em nova aba caso o iframe nao carregue, e adicionar `sandbox` e `referrerpolicy` ao iframe para maximizar compatibilidade.

## Risco
Se o Monitor Contabil enviar `X-Frame-Options: DENY` ou `SAMEORIGIN`, o iframe nao funcionara independente da nossa CSP. Nesse caso, a alternativa sera um botao "Abrir Monitor Contabil" que abre em nova aba.

