
# Corrigir a assinatura XML do AUTENTICAPROCURADOR

## Diagnóstico
O erro mudou e agora está objetivo:

`[AcessoNegado-AUTENTICAPROCURADOR-013] XML assinado inválido: A assinatura do evento deverá ser realizada sobre todo documento Xml (Atributo 'URI' dever ser vazio).`

Pelo código atual em `supabase/functions/integra-contador/index.ts` e pela documentação enviada:
- a documentação do SERPRO mostra `reference uri=""`
- o código atual força `Reference URI="#termo-autorizacao"`
- o código também adiciona `Id="termo-autorizacao"` na raiz
- além disso, a assinatura hoje é montada de forma frágil: calcula digest do XML bruto e assina uma versão de `SignedInfo`, mas insere outra versão no XML final

Ou seja: o problema agora não é mais o texto do termo, e sim a forma de assinatura XML.

## O que vou ajustar

### 1. Assinar o documento inteiro com `URI=""`
Vou remover a lógica que extrai `Id` da raiz e parar de usar `#termo-autorizacao`.

Ficará assim:
```xml
<Reference URI="">
```

E a raiz voltará a não depender de `Id` para assinatura.

### 2. Remover o `Id` da tag raiz
Hoje o root está como:
```xml
<termoDeAutorizacao Id="termo-autorizacao">
```

Vou alinhar ao modelo do SERPRO e remover esse atributo, já que a assinatura deve apontar para o documento inteiro, não para um fragmento.

### 3. Corrigir a montagem do `SignedInfo`
Hoje o código:
- monta um `SignedInfo`
- assina esse texto
- depois insere no XML uma versão alterada com `replace(...)`

Isso é arriscado para validação criptográfica.

Vou mudar para:
- gerar uma única versão final de `SignedInfo`
- assinar exatamente essa versão
- inserir exatamente a mesma estrutura dentro de `<Signature>`

### 4. Corrigir o digest para seguir o XMLDSig esperado
Hoje o digest é feito sobre os bytes brutos do XML string.

Vou ajustar para calcular o digest do documento da forma esperada pelo SERPRO/XMLDSig:
- documento completo
- sem depender de `Id`
- respeitando a lógica de `enveloped-signature`
- com canonicalização coerente antes do hash

Isso evita rejeição mesmo depois de corrigir o `URI`.

### 5. Manter os textos oficiais já corrigidos
Os textos de:
- `termo`
- `avisoLegal`
- `finalidade`

devem permanecer exatamente como estão agora, porque os erros anteriores mostraram que o SERPRO valida isso literalmente.

### 6. Melhorar logs da assinatura
Vou incluir logs mais úteis para depuração:
- `Reference URI` usado
- tamanho do XML antes/depois da assinatura
- digest gerado
- trecho do `SignedInfo` final realmente assinado

Assim, se houver nova rejeição, fica claro se o problema restante é de canonicalização ou de estrutura.

## Arquivo envolvido
- `supabase/functions/integra-contador/index.ts`

## Resultado esperado
Após essa correção:
- o erro sobre `URI` vazio deve desaparecer
- o AUTENTICAPROCURADOR deve aceitar o XML assinado
- a função poderá finalmente receber o `autenticar_procurador_token` e prosseguir com a consulta principal

## Detalhes técnicos
Principais diferenças entre o estado atual e o correto:

```text
Atual
- Root com Id
- Reference URI="#termo-autorizacao"
- Digest do XML bruto
- SignedInfo assinado != SignedInfo inserido

Correto
- Root sem dependência de Id
- Reference URI=""
- Assinatura sobre o documento inteiro
- Digest/canonicalização coerentes
- SignedInfo assinado = SignedInfo inserido
```

## Observação
Não há necessidade de mudar banco, UI ou payload principal da consulta. A correção é toda na rotina de geração e assinatura do XML do termo.
