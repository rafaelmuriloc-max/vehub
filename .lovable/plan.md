
# Corrigir rejeição do `avisoLegal` no AUTENTICAPROCURADOR

## Diagnóstico
O erro atual não é mais de token nem de estrutura básica: o SERPRO está rejeitando o **conteúdo literal** do XML.

Pelos logs e pelo código atual em `supabase/functions/integra-contador/index.ts`:
- o XML está sendo gerado com textos em **ASCII simplificado** (`autorizacao`, `informacoes`, `7o`, `n.` etc.)
- as tags estão em formato **self-closing** (`<avisoLegal ... />`)
- a assinatura usa `Reference URI=""` porque o root não tem `Id`

O SERPRO já validou o `termo` antes e agora está barrando o `avisoLegal`, o que indica validação **campo a campo**, muito provavelmente por comparação estrita com o modelo oficial.

## O que vou implementar

### 1. Usar os textos oficiais exatamente como no modelo SERPRO
Em `generateSerproProcuradorXML`:
- trocar `termoTexto`, `avisoTexto` e `finalidadeTexto` pelas versões **literais**, com:
  - acentos
  - `7º`, `11º`
  - `n.º 13.709`
  - pontuação original
  - maiúsculas/minúsculas do modelo

Isso é a correção principal do erro atual.

### 2. Escapar corretamente atributos XML
Como esses textos terão aspas, acentos e caracteres especiais, vou prever escape seguro de atributos:
- `&` → `&amp;`
- `"` → `&quot;`
- `<` → `&lt;`

Também vou aplicar isso nos nomes do contratante e do cliente para evitar XML inválido com razão social contendo caracteres especiais.

### 3. Padronizar o XML para fechamento explícito
Hoje o código gera self-closing tags, mas os próprios comentários e a memória do projeto apontam melhor compatibilidade com C14N usando fechamento explícito.

Vou alinhar para:
```xml
<sistema ...></sistema>
<termo ...></termo>
<avisoLegal ...></avisoLegal>
...
```

### 4. Adicionar `Id` no root e assinar com referência explícita
Vou ajustar o root para algo como:
```xml
<termoDeAutorizacao Id="termo-autorizacao">
```
e fazer a assinatura referenciar:
```xml
<Reference URI="#termo-autorizacao">
```

Isso deixa o XMLDSig mais consistente e reduz risco de rejeição por assinatura/reference ambígua.

### 5. Manter o fail-fast e melhorar a depuração
Vou preservar o comportamento atual de abortar quando o procurador token não vier, mas melhorar a saída para facilitar novos testes:
- informar que a rejeição veio da validação literal do XML
- continuar retornando `stage: "autentica_procurador"`
- manter `serpro_response` completo

## Arquivo envolvido
- `supabase/functions/integra-contador/index.ts`

## Resultado esperado
Após a correção:
- o `avisoLegal` deve deixar de ser rejeitado por texto inválido
- se houver novo bloqueio, ele deve avançar para o próximo campo de validação ou finalmente aceitar o termo
- a assinatura XML ficará mais aderente ao padrão esperado pelo SERPRO

## Detalhes técnicos
- o problema visível agora é o uso de texto “normalizado” em ASCII, enquanto o SERPRO aparentemente exige o conteúdo oficial literal
- como os textos ficam em atributos XML, o escape correto passa a ser obrigatório
- usar `Id` no root melhora a robustez da assinatura digital e evita depender de `Reference URI=""`
