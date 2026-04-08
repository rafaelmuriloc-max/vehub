
# Corrigir fluxo do termo de autorização para realmente liberar a consulta

## Diagnóstico
O erro `AcessoNegado-ICGERENCIADOR-019` mostra que a consulta final ainda está chegando ao SERPRO sem uma autorização válida do procurador, mesmo com a etapa de XML já implementada.

Pelo código atual em `supabase/functions/integra-contador/index.ts`, o fluxo já:
1. detecta quando `autorPedidoDados != contratante`
2. gera o XML
3. assina com o certificado do cliente
4. envia `AUTENTICAPROCURADOR / ENVIOXMLASSINADO81`
5. tenta extrair `autenticar_procurador_token`
6. só adiciona o header final se esse token for encontrado

O ponto mais provável de falha é este:
- a chamada de `Apoiar` está retornando algo diferente do formato esperado
- o token não está sendo extraído
- a função segue mesmo assim “tentando sem ele”
- a consulta principal volta 403 exatamente como no retorno que você enviou

Ou seja: o problema agora não parece ser mais a tag raiz do XML, e sim a obtenção/uso do token de procurador.

## O que vou implementar

### 1. Tornar o fluxo de procurador obrigatório quando necessário
Hoje, se `obtainProcuradorToken()` falha, a função apenas faz log e continua sem o header.

Vou trocar esse comportamento para:
- se `autorPedidoDados !== contratanteCnpj`
- e não for possível obter `autenticar_procurador_token`
- a função deve retornar erro claro imediatamente

Assim evitamos consulta “sabidamente inválida” ao SERPRO e passamos a enxergar o erro real da etapa de autorização.

### 2. Melhorar a leitura da resposta do `AUTENTICAPROCURADOR`
Vou ajustar `obtainProcuradorToken()` para tentar extrair o token em mais formatos, por exemplo:
- `data.autenticar_procurador_token`
- `data.token`
- `data.dados` como string JSON
- `data.dados` como valor simples
- headers com variações de nome/case
- resposta texto puro

Isso é importante porque o PDF mostra a chamada, mas não garante que a resposta venha sempre no mesmo shape que o código atual assume.

### 3. Logar a resposta estruturada da etapa de autorização
Vou reforçar os logs do `AUTENTICAPROCURADOR` para registrar:
- status HTTP
- body completo truncado com segurança
- headers relevantes
- em qual campo o token foi encontrado, se encontrado
- motivo exato quando não encontrado

Assim fica possível validar se:
- o XML foi aceito
- o token foi devolvido em outro campo
- ou a autorização em si ainda está sendo rejeitada

### 4. Validar o payload enviado ao `AUTENTICAPROCURADOR`
Vou revisar o body para garantir aderência estrita ao padrão esperado:
- `contratante` = escritório
- `autorPedidoDados` = cliente/procurador que assina
- `contribuinte` = cliente
- `pedidoDados.idSistema = AUTENTICAPROCURADOR`
- `pedidoDados.idServico = ENVIOXMLASSINADO81`
- `pedidoDados.dados = "{\"xml\":\"BASE64\"}"`

Também vou conferir se o `xml` precisa seguir exatamente como base64 do documento UTF-8 assinado, sem transformação extra.

### 5. Revisar o XML assinado para compatibilidade com o exemplo do SERPRO
Embora a raiz já tenha sido corrigida, o PDF indica detalhes importantes. Vou alinhar:
- textos legais ao modelo oficial
- atributos e valores esperados
- fechamento explícito das tags
- inserção da assinatura dentro de `<termoDeAutorizacao>`
- digest/reference coerentes com o documento efetivamente assinado

Especial atenção para:
- ausência de `Id` no root hoje faz `Reference URI=""`
- isso pode ser aceito ou não pelo SERPRO; vou revisar a necessidade de identificar o documento explicitamente e manter consistência entre digest e `SignedInfo`

### 6. Ajustar a resposta para o frontend
Se a etapa de procurador falhar, a edge function deve retornar algo como:
- `success: false`
- `stage: "autentica_procurador"`
- mensagem amigável explicando que a autorização não foi emitida
- detalhes técnicos do SERPRO quando existirem

Isso melhora muito a depuração na tela `/integra-contador`.

## Arquivos envolvidos
- `supabase/functions/integra-contador/index.ts`

## Resultado esperado
Após a correção:
- quando o cliente for diferente do contratante, a função deve primeiro obter com sucesso o `autenticar_procurador_token`
- só então enviar a consulta principal com esse header
- se o token não vier, a função deve falhar explicitamente na etapa de autorização, sem seguir para a consulta
- o erro 403 atual deve desaparecer quando o termo for aceito, ou então será substituído por uma mensagem mais precisa sobre o que ainda falta no XML/assinatura

## Detalhes técnicos
- Hoje o código já inclui o header `autenticar_procurador_token`, mas apenas se conseguir extrair o token
- O principal bug funcional é que o fluxo continua mesmo quando essa etapa falha
- A documentação enviada confirma que o objetivo do `ENVIOXMLASSINADO81` é justamente devolver esse token para uso nas requisições seguintes
- O plano não exige mudança de banco nem nova tabela; é uma correção da edge function e da forma como ela trata a autorização

<lov-actions>
<lov-suggestion message="Test the Integra Contador procurador flow end-to-end with a client whose CNPJ is different from the office and verify whether the authorization token is now generated and used in the final request.">Verify that it works</lov-suggestion>
<lov-suggestion message="Add a visible debug section in the Integra Contador page showing the authorization stage, whether the procurador token was obtained, and the exact SERPRO stage that failed.">Improve SERPRO debugging</lov-suggestion>
<lov-suggestion message="Show the AUTENTICAPROCURADOR response details in the Integra Contador UI when authorization fails, including stage and SERPRO message codes.">Expose authorization errors in UI</lov-suggestion>
</lov-actions>
