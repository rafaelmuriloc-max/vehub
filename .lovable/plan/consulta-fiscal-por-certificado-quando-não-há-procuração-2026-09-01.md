# Consulta fiscal por certificado quando não há procuração

Hoje, quando o SERPRO recusa o Termo de Autorização (procuração eletrônica ausente ou vencida no e-CAC), a consulta é abortada e o cliente fica como "Sem procuração". Situação atual no banco: 14 clientes nesse status, sendo 11 deles com certificado digital A1 cadastrado — ou seja, há material para uma segunda tentativa.

## O que muda

Quando a etapa de procuração falhar por ausência/vencimento de procuração, o sistema não desiste: tenta automaticamente uma segunda rota usando o certificado digital A1 da própria empresa.

Ordem de tentativa por cliente:

```text
1) Procuração eletrônica (fluxo atual, termo assinado + token)
   falhou por "procuração ausente/vencida"?
2) Fallback: consulta direta com o certificado A1 do cliente
   (o próprio contribuinte como autor do pedido, sem token de procurador)
   falhou também?
3) Status "Sem procuração" com a mensagem do SERPRO
```

Se o cliente não tiver certificado cadastrado, o passo 2 é pulado e a mensagem indica que falta o certificado.

## Detalhes técnicos

`supabase/functions/integra-contador/index.ts`
- Extrair a montagem/execução da chamada ao SERPRO em uma função reutilizável (hoje `requestBody` + `callSerproApi` são fechados sobre variáveis do escopo).
- Quando `obtainProcuradorToken` retornar erro cujo corpo/mensagem indique procuração ausente ou vencida, em vez de retornar erro imediatamente:
  - se o cliente tiver `digital_certificate_url`/`password`, refazer a autenticação OAuth e a chamada usando o PFX do cliente (`clientCertPem`/`clientKeyPem`, já baixados e parseados no fluxo atual) como certificado mTLS, com `autorPedidoDados = contribuinte` e sem o header `autenticar_procurador_token`;
  - devolver no payload de sucesso um campo `auth_mode: 'procuracao' | 'certificado_proprio'` para rastreio;
  - se essa tentativa também falhar, manter a resposta atual de `stage: autentica_procurador`, agora com `fallback_tentado: true` e o erro do SERPRO nas duas etapas.
- Logs prefixados `[fallback-cert]` em cada etapa, para diagnóstico no painel de logs da função.

`src/components/integra-contador/SituacaoFiscalTab.tsx`
- O worker silencioso que hoje reprocessa apenas `error` passa a reprocessar também `sem_procuracao` de clientes **com** certificado cadastrado (uma rodada por sessão, com o mesmo espaçamento atual, para não sobrecarregar o SERPRO).
- Clientes `sem_procuracao` sem certificado continuam intocados e a mensagem exibida deixa claro que falta o certificado A1.
- Guardar o `auth_mode` retornado e exibir um marcador discreto "via certificado" na linha do cliente consultado por essa rota.

## Verificação

- Rodar a consulta manualmente para 2 clientes hoje em `sem_procuracao` com certificado e conferir nos logs da edge function se o fallback foi acionado e qual a resposta do SERPRO.
- Se o SERPRO recusar a rota de certificado próprio (possível, pois a autenticação OAuth é vinculada ao CNPJ contratante), o resultado do teste será reportado antes de qualquer ajuste adicional — nesse caso a alternativa é regularizar a procuração no e-CAC, e o sistema passará a informar isso explicitamente na mensagem.
