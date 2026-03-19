

# Implementar fluxo de Autenticação de Procurador (Termo de Autorização)

## Problema

O erro 403 `[AcessoNegado-ICGERENCIADOR-019]` ocorre porque quando o `autorPedidoDados` (cliente) **difere** do `contratante` (escritório), o SERPRO exige um **Termo de Autorização** assinado digitalmente pelo cliente (procurador). Sem esse termo, o contratante não pode consultar em nome do cliente.

O fluxo oficial do SERPRO exige dois passos:
1. **Enviar XML assinado** (com o certificado do cliente) via `AUTENTICAPROCURADOR/ENVIOXMLASSINADO81` no endpoint `/Apoiar` para obter um `autenticar_procurador_token`
2. **Usar esse token** no header `autenticar_procurador_token` em todas as requisições subsequentes para aquele cliente

## Solução

Implementar o fluxo completo em 3 partes:

### 1. Edge Function: Gerar e assinar o XML do Termo de Autorização

No `supabase/functions/integra-contador/index.ts`, adicionar lógica que:

- Quando o `autorPedidoDados` (cliente) for diferente do `contratante` (escritório), **antes** da consulta principal:
  - Gera o XML do Termo de Autorização com os dados do contratante e do cliente
  - Assina o XML com o certificado digital do **cliente** (já armazenado no Supabase Storage via `clients.digital_certificate_url` e `clients.digital_certificate_password`)
  - Converte para base64
  - Chama `AUTENTICAPROCURADOR/ENVIOXMLASSINADO81` via endpoint `/Apoiar`
  - Extrai o `autenticar_procurador_token` da resposta
  - Inclui esse token no header das requisições subsequentes

### 2. Modificações no Edge Function (index.ts)

**Novo fluxo antes da chamada principal (entre linhas 176-206):**

```text
1. Baixar certificado do CLIENTE (clients.digital_certificate_url/password)
2. Gerar XML do Termo de Autorização:
   - destinatario = contratante (escritório)
   - assinadoPor = autorPedidoDados (cliente)
   - vigencia = data atual + 1 ano
3. Assinar XML com chave privada do cliente (XMLDSig via node-forge)
4. Converter XML assinado para base64
5. Chamar /Apoiar com AUTENTICAPROCURADOR/ENVIOXMLASSINADO81
6. Extrair autenticar_procurador_token da resposta
7. Adicionar header "autenticar_procurador_token" na chamada principal
```

**Mudanças específicas:**
- Linha 67-71: Adicionar `digital_certificate_url, digital_certificate_password` ao select de clients
- Linhas 196-204: Adicionar header `autenticar_procurador_token` quando disponível
- Nova função `generateSignedAuthorizationXml()` para gerar e assinar o XML
- Nova função `obtainProcuradorToken()` que orquestra o fluxo completo

### 3. Frontend (IntegraContador.tsx)

- Sem mudanças significativas no frontend -- o fluxo é transparente para o usuário
- Apenas melhorar o toast de erro para sugerir que o certificado do cliente pode estar faltando

## Detalhes Técnicos

**Estrutura do XML do Termo de Autorização** (conforme documentação SERPRO):
```text
<termoDeAutorizacao>
  <dados>
    <sistema id="API Integra Contador" />
    <termo texto="Autorizo a empresa CONTRATANTE..." />
    <avisoLegal texto="..." />
    <finalidade texto="..." />
    <dataAssinatura data="AAAAMMDD" />
    <vigencia data="AAAAMMDD" />
    <destinatario numero="CNPJ_ESCRITORIO" nome="NOME" tipo="PJ" papel="contratante" />
    <assinadoPor numero="CNPJ_CLIENTE" nome="NOME" tipo="PJ" papel="autor pedido de dados" />
  </dados>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">...</Signature>
</termoDeAutorizacao>
```

**Assinatura digital**: Usa XMLDSig (enveloped signature) com RSA-SHA256, usando a chave privada extraída do PFX do cliente.

**Certificado do cliente**: Já existe no banco (`clients.digital_certificate_url` e `clients.digital_certificate_password`) e no Storage bucket `certificates`.

### Arquivos modificados
- `supabase/functions/integra-contador/index.ts` -- lógica principal do fluxo de procurador

