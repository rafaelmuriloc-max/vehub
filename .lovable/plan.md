
Objetivo: corrigir o AUTENTICAPROCURADOR de forma definitiva, alinhando o fluxo ao cenário oficial do SERPRO e evitando novas chamadas com XML inválido.

Diagnóstico atualizado
- A documentação que você colou confirma que, no AUTENTICAPROCURADOR / ENVIOXMLASSINADO81:
  - usa o Bearer token obtido na etapa “Como Autenticar na API”
  - `jwt_token` fica vazio
  - `autenticar_procurador_token` fica vazio
  - o XML deve ser assinado pelo Autor do Pedido de Dados (procurador), ou seja, com o certificado do cliente
- No código atual, a assinatura ainda é montada “na mão” com hash do XML bruto, sem canonicalização XMLDSig real. Isso explica o erro persistente de assinatura inválida.
- O código já usa o certificado do cliente para assinar, mas falta garantir criptograficamente que o XML final enviado é exatamente o mesmo que foi digerido e assinado.

Plano de correção
1. Ajustar o request do AUTENTICAPROCURADOR para seguir a documentação
- Na chamada específica de `ENVIOXMLASSINADO81`, enviar apenas:
  - `Authorization: Bearer ...`
  - `Content-Type: application/json`
  - `Accept: application/json`
- Não enviar `jwt_token` nessa etapa.
- Continuar usando o certificado do escritório apenas no mTLS da chamada HTTP.
- Continuar usando o certificado A1 do cliente apenas para assinar o XML.

2. Reescrever a assinatura XML com fluxo determinístico
- Refatorar `signXmlWithCertificate` para parar de usar digest do XML bruto.
- Implementar um pipeline XMLDSig consistente:
  - gerar o XML sem assinatura
  - construir o `SignedInfo` com `Reference URI=""`
  - aplicar lógica de `enveloped-signature`
  - canonicalizar o documento inteiro
  - calcular `DigestValue` a partir da forma canonicalizada
  - canonicalizar o `SignedInfo`
  - assinar exatamente esse `SignedInfo`
  - montar o XML final sem alterar nada depois da assinatura
- Resultado esperado:
```text
Digest calculado sobre o documento inteiro
+
SignedInfo canonicalizado
+
Signature inserida sem mutações posteriores
```

3. Adicionar verificação local antes de consumir crédito no SERPRO
- Criar uma validação local da assinatura antes do POST para o SERPRO:
  - recomputar o digest do XML final
  - validar o `SignatureValue` com a chave pública do certificado embutido
- Se a validação local falhar, a função aborta antes da chamada externa.
- Isso evita “queimar crédito” com XML já inválido localmente.

4. Tornar explícito que a assinatura é do certificado do cliente
- Validar e logar de forma segura qual certificado está sendo usado na assinatura:
  - subject / serial resumido
  - documento do cliente relacionado
- Se houver divergência entre o certificado do cliente carregado e o cadastro esperado, retornar erro local claro.
- Isso elimina ambiguidade entre:
  - certificado do escritório = transporte/mTLS
  - certificado do cliente = assinatura do termo

5. Cobrir com testes focados da edge function
- Adicionar testes Deno para:
  - `Reference URI=""`
  - ausência de `jwt_token` no request do AUTENTICAPROCURADOR
  - geração do XML com textos oficiais
  - verificação local da assinatura passando no XML íntegro
  - verificação local falhando se qualquer byte do XML for alterado após assinar
- Isso cria uma trava para não regredir novamente.

Arquivos envolvidos
- `supabase/functions/integra-contador/index.ts`
- novo teste para `supabase/functions/integra-contador`

Sem mudanças em banco ou UI
- Não precisa alterar tabelas, RLS ou páginas.
- A correção é toda no fluxo da edge function.

Resultado esperado
- O AUTENTICAPROCURADOR passa a seguir o cenário oficial do SERPRO.
- O XML passa a ser assinado corretamente com o certificado do cliente.
- A função só envia ao SERPRO XML previamente validado localmente.
- O erro de assinatura inválida deixa de ser tratado por tentativa e erro em produção.

Detalhes técnicos
```text
Transporte HTTP:
- mTLS com certificado do escritório
- Bearer token da autenticação SERPRO
- sem jwt_token no AUTENTICAPROCURADOR

Assinatura XML:
- certificado do cliente
- Reference URI=""
- enveloped-signature
- canonicalização real antes de digest e assinatura
- validação local obrigatória antes do envio
```
