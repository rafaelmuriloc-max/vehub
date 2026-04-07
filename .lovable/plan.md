

# Corrigir assinatura XML do Procurador (Integra Contador)

## Problema
O SERPRO retorna `403 AcessoNegado-AUTENTICAPROCURADOR-013: XML assinado inválido`. Os logs confirmam que o XML está sendo enviado com a assinatura, mas a verificação falha.

**Causa raiz**: O XML do Termo de Autorização usa tags auto-fechantes (`<sistema id="..." />`), mas a canonicalização C14N (aplicada pelo SERPRO ao verificar o digest) converte todas para formato expandido (`<sistema id="..."></sistema>`). Como o digest é computado sobre o XML com tags auto-fechantes, os hashes não batem.

Tags afetadas (todas em `generateAuthorizationXml`):
```text
<sistema id="..." />        → <sistema id="..."></sistema>
<termo texto="..." />       → <termo texto="..."></termo>
<avisoLegal texto="..." />  → <avisoLegal texto="..."></avisoLegal>
<finalidade texto="..." />  → <finalidade texto="..."></finalidade>
<dataAssinatura data="..." /> → <dataAssinatura data="..."></dataAssinatura>
<vigencia data="..." />     → <vigencia data="..."></vigencia>
<destinatario ... />        → <destinatario ...></destinatario>
<assinadoPor ... />         → <assinadoPor ...></assinadoPor>
```

O erro `400 Campo xml nulo` que o usuário viu é um efeito secundário: quando o procurador falha, a requisição principal prossegue sem o token, e o SERPRO rejeita porque os `dados` do usuário não contêm o campo `xml`.

## Solução

### `supabase/functions/integra-contador/index.ts`

1. **`generateAuthorizationXml`** (linhas 38-59): Trocar todas as tags auto-fechantes (`/>`) por tags com fechamento explícito (`></tag>`), para que o XML já esteja em forma canônica C14N.

2. **`signXmlWithCertificate`** (linha 67): Adicionalmente, garantir que o digest é computado sobre o XML canonicalizado (sem tags auto-fechantes). Com a correção no ponto 1, isso já fica resolvido.

3. **Segurança extra**: Adicionar um log do digest computado para facilitar debugging futuro.

## Arquivo alterado
- `supabase/functions/integra-contador/index.ts` — ~8 tags corrigidas na função `generateAuthorizationXml`

