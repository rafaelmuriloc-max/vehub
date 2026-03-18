

# Correção de Vulnerabilidades de Segurança

## Contexto

O scan detectou 8 vulnerabilidades. Algumas são controladas pelo servidor/Cloudflare e não podem ser corrigidas no frontend. Vou focar nas que podemos resolver:

## O que pode ser corrigido no projeto

### 1. CSP (Content Security Policy) via meta tag
Adicionar uma meta tag `Content-Security-Policy` no `index.html` para mitigar XSS. Não é tão forte quanto um header HTTP, mas reduz a superfície de ataque.

### 2. Proteção contra brute force no login
Implementar rate limiting client-side no formulário de login:
- Após 5 tentativas falhas consecutivas, bloquear por 60 segundos
- Mostrar contador regressivo ao usuário
- Resetar após login bem-sucedido

### 3. Permissions-Policy via meta tag
Não é suportado via meta tag — apenas header HTTP.

## O que NÃO pode ser corrigido aqui

| Vulnerabilidade | Motivo |
|---|---|
| X-Frame-Options | Header HTTP configurado no servidor de hosting (Lovable/Cloudflare) |
| Permissions-Policy | Idem — só via header HTTP |
| Cookie `__cf_bm` sem SameSite | Cookie do Cloudflare, fora do nosso controle |

Essas 3 dependem de configuração no nível do servidor/CDN.

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `index.html` | Adicionar meta tag CSP |
| `src/pages/Auth.tsx` | Adicionar rate limiting client-side (contador de tentativas, bloqueio temporário após 5 falhas) |

