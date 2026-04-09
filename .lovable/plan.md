

# Corrigir canonicalização C14N: adicionar ordenação de atributos

## Problema raiz identificado

O SERPRO usa uma implementação padrão W3C de Canonical XML (C14N) que **ordena atributos alfabeticamente por nome local**. Nossa função `canonicalize()` apenas expande self-closing tags mas **não reordena atributos**.

Exemplo concreto do que acontece:

```text
Nosso digest (atributos na ordem original):
<destinatario numero="594..." nome="Velocitã..." tipo="PJ" papel="contratante"></destinatario>

C14N correto do SERPRO (atributos em ordem alfabética):
<destinatario nome="Velocitã..." numero="594..." papel="contratante" tipo="PJ"></destinatario>

→ Digests diferentes → assinatura inválida
```

Isso afeta os elementos `<destinatario>`, `<assinadoPor>`, e qualquer outro com mais de um atributo. O digest que assinamos localmente é diferente do que o SERPRO calcula, então a assinatura é sempre rejeitada.

## Solução

Reescrever a função `canonicalize()` em `supabase/functions/integra-contador/index.ts` para implementar C14N corretamente:

1. Fazer parse do XML com regex para extrair cada elemento e seus atributos
2. Ordenar atributos de cada elemento alfabeticamente pelo nome do atributo
3. Expandir self-closing tags (já faz)
4. Manter tudo o mais intacto (texto, encoding UTF-8, etc.)

A nova função vai:
- Usar regex para encontrar cada tag de abertura ou self-closing
- Extrair todos os pares atributo="valor"
- Reordená-los por nome do atributo
- Reconstruir a tag com atributos ordenados

## Detalhes técnicos

```text
Funções afetadas:
- canonicalize(): reescrita completa (~20 linhas)
- Nenhuma outra mudança necessária

O que a nova canonicalize() fará:
1. Match cada tag: <tagName attr1="v1" attr2="v2" ... />  ou  <tagName attr1="v1" ...>
2. Parse dos atributos em pares [nome, valor]
3. Sort por nome (String.localeCompare ou simples <)
4. Reconstruir: <tagName attrA="vA" attrB="vB">  (ou ...></tagName> se era self-closing)

Arquivo: supabase/functions/integra-contador/index.ts
Alteração: ~25 linhas (função canonicalize, linhas ~93-97)
```

## Resultado esperado
- O digest calculado localmente será idêntico ao que o SERPRO calcula com sua implementação C14N padrão
- A assinatura passará na verificação do SERPRO
- A verificação local continuará passando (pois usa a mesma canonicalização)

