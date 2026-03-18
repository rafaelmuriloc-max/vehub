
Diagnostiquei o que está impedindo a emissão da NFS-e e o problema principal não é a tela em si nem a conexão básica com o SEFIN.

## O que encontrei

A função `nfse-emit` está conseguindo:
- autenticar o usuário,
- buscar o cliente,
- baixar o certificado A1,
- montar e assinar um XML,
- tentar enviar ao endpoint do SEFIN.

Ou seja: o bloqueio não parece ser “certificado ausente”, “senha errada” ou “queda de rede” como causa principal desta emissão.

## O erro real

Comparando o XML gerado hoje em `supabase/functions/nfse-emit/index.ts` com XMLs de emissões que já deram certo e estão salvos na tabela `invoices`, há diferenças importantes no leiaute da DPS.

Hoje a função monta uma DPS simplificada, mas as emissões bem-sucedidas no seu banco usam uma estrutura diferente e mais completa.

### Diferenças críticas

1. `serie` e `nDPS`
- Hoje a função usa:
  - `serie = "EPN"`
  - `nDPS` com `padStart(15, "0")`
- Nas notas emitidas com sucesso, o XML usa:
  - `serie` simples como `"1"`
  - `nDPS` sem esse formato artificial no XML final

Isso também afeta o `Id` da DPS.

2. Estrutura do serviço
- Hoje a função envia:
  - `<serv><cServ>...</cServ><xDescServ>...</xDescServ>...`
- Nas emissões válidas aparece:
  - `<serv><locPrest>...`
  - `<cServ><cTribNac>...</cTribNac><xDescServ>...</xDescServ>...</cServ>`

Ou seja, o campo de código de serviço está indo em formato diferente do esperado pelo padrão nacional.

3. Tributação
- Hoje a função envia:
  - `<trib><totTrib><indTotTrib>0</indTotTrib></totTrib><ISS>...`
- Nas emissões válidas aparece:
  - `<trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>...</tpRetISSQN><pAliq>...</pAliq></tribMun>...`

A estrutura atual não bate com o modelo que já funcionou no seu próprio banco.

4. Dados do prestador insuficientes
- A função atual carrega do cliente apenas:
  - `document`, `digital_certificate_url`, `digital_certificate_password`, `company_name`, `municipal_registration`, `address`
- Mas os XMLs válidos têm mais dados no prestador:
  - `xNome`
  - `fone`
  - `email`
  - `regTrib` (`opSimpNac`, `regEspTrib`, às vezes `regApTribSN`)

Sem isso, o XML fica incompleto para vários municípios/regras.

5. Inscrição municipal ausente
Pelo banco, todos os clientes ativos que você está testando estão com `municipal_registration = null`.

Para emissão nacional, isso é um forte candidato a rejeição, porque os XMLs válidos salvos no banco têm IM preenchida no prestador.

6. Assinatura digital divergente
Os XMLs válidos que já existem no banco mostram assinatura com:
- `rsa-sha1`
- digest `sha1`

A função atual assina com:
- `rsa-sha256`
- digest `sha256`

Mesmo que o padrão mais novo aceite SHA-256 em alguns cenários, o seu histórico de sucesso mostra que o ambiente que funcionou para seus clientes foi outro. Isso pode causar rejeição dependendo da implementação do validador do SEFIN/município.

## Conclusão

O que impede a emissão hoje é, principalmente, uma combinação de:

- XML da DPS fora do leiaute que já funcionou no seu projeto,
- ausência de dados fiscais obrigatórios/influentes do prestador, especialmente inscrição municipal,
- possível incompatibilidade no formato da assinatura digital,
- montagem simplificada demais para o padrão nacional real.

## Plano de correção

### 1. Reescrever a montagem do XML da DPS
Ajustar `supabase/functions/nfse-emit/index.ts` para gerar a estrutura no mesmo padrão das notas que já foram emitidas com sucesso no seu banco:
- `prest` com `IM`, `fone`, `email`, `regTrib`
- `serv` com `locPrest` e `cServ/cTribNac`
- `trib/tribMun/tpRetISSQN`
- mesma convenção prática de `serie` e `nDPS`

### 2. Fazer a função carregar mais dados do cliente
Expandir a leitura do cliente para trazer o necessário para o XML:
- `contact_phone`
- `contact_email`
- `tax_regime`
- possivelmente outros dados fiscais que já existem na tabela `clients`

### 3. Tratar regime tributário corretamente
Mapear `clients.tax_regime` para os nós esperados em `regTrib`, por exemplo:
- simples nacional
- lucro presumido / não simples
- casos especiais

### 4. Validar antes de enviar ao SEFIN
Adicionar validações explícitas na função para bloquear emissão antes do envio quando faltar:
- inscrição municipal do prestador,
- código do serviço compatível,
- município IBGE,
- dados mínimos do tomador,
- dados tributários mínimos.

Assim o usuário recebe erro claro no sistema em vez de uma rejeição opaca do SEFIN.

### 5. Revisar a assinatura digital
Alinhar a assinatura com o formato que já consta nas emissões válidas do seu banco, ou ao menos tornar isso configurável/testável para confirmar se o ambiente atual exige SHA-1 nesse fluxo.

### 6. Ajustar a tela de emissão
Na página `src/pages/InvoiceEmit.tsx`, atualizar os rótulos e validações para refletir o que o XML realmente espera:
- deixar claro se o campo é `cTribNac` e não apenas “código LC 116”,
- avisar quando o cliente prestador estiver sem inscrição municipal,
- impedir envio quando o cadastro fiscal do cliente estiver incompleto.

## Arquivos que eu alteraria

- `supabase/functions/nfse-emit/index.ts`
- `src/pages/InvoiceEmit.tsx`

## Observação importante

Além do problema técnico da função, seus clientes ativos testados no banco estão sem `municipal_registration`. Então, mesmo com a função corrigida, a emissão pode continuar falhando para esses clientes até completar esse dado no cadastro.

## Prioridade recomendada

1. Corrigir a edge function para espelhar o XML de emissões já bem-sucedidas.
2. Bloquear emissão para cliente sem inscrição municipal.
3. Ajustar a tela para orientar o preenchimento correto.
4. Testar primeiro com um cliente que já tenha todos os dados fiscais completos.

## Detalhe técnico resumido

```text
Hoje:
UI -> nfse-emit -> gera DPS simplificada -> assina -> envia -> provável rejeição

Esperado:
UI -> nfse-emit -> gera DPS no mesmo leiaute das notas já válidas -> valida dados fiscais -> assina no formato compatível -> envia
```

<lov-actions>
<lov-suggestion message="Teste a emissão de NFS-e end-to-end depois das correções para confirmar se o XML foi aceito pelo SEFIN">Verifique que funciona</lov-suggestion>
<lov-suggestion message="Corrija a edge function nfse-emit para gerar o XML no mesmo padrão das NFS-e que já foram emitidas com sucesso no banco, incluindo prestador, regTrib, cTribNac e estrutura de tributos">Corrigir XML da NFS-e</lov-suggestion>
<lov-suggestion message="Bloqueie a emissão quando o cliente prestador estiver sem inscrição municipal, regime tributário ou outros dados fiscais obrigatórios, exibindo mensagens claras na tela">Adicionar validações fiscais</lov-suggestion>
<lov-suggestion message="Ajuste a tela de emissão para orientar melhor o preenchimento de código tributário nacional, município IBGE e dados do prestador antes de enviar ao SEFIN">Melhorar formulário de emissão</lov-suggestion>
</lov-actions>
