# FGTS Digital: consultar com o certificado de cada cliente

## O que muda para você
- Cada empresa passa a ser consultada com o próprio certificado digital A1 dela, salvo no cadastro do cliente. A procuração no FGTS Digital deixa de ser necessária.
- Das 204 empresas ativas, 192 têm certificado e senha cadastrados. As outras 12 aparecem com a situação "Sem certificado" e não geram cobrança na Infosimples.
- Certificados vencidos são pulados e aparecem como "Certificado vencido".
- No fim de "Consultar todas", o aviso mostra quantas deram certo, quantas não têm certificado e quantas falharam.

## Antes de testar
- A chave de criptografia salva hoje é igual ao token. Vou abrir o formulário para você colar a **chave de criptografia** real, que fica na sua conta Infosimples, em Administração > Conta > Chave de criptografia.
- O token salvo tem a palavra "visibility" colada no final. O sistema vai remover isso sozinho.

## Detalhes técnicos
- `fgts-digital-sync`: buscar `digital_certificate_url`, `digital_certificate_password` e `digital_certificate_expiry` em `clients`, baixar do bucket `certificates` e criptografar com aes-bridge. Não enviar `representado`, porque o titular é a própria empresa.
- Remover " visibility" e os espaços do token.
- Retornar `{ skipped: "sem_certificado" | "certificado_vencido" }` sem chamar a Infosimples. A tela grava a situação correspondente na linha da empresa.
- Adicionar `console.log` e `console.error` com o CNPJ, o código da Infosimples e as mensagens de erro, sem registrar a senha nem o certificado.
- `FgtsDigital.tsx`: mostrar os selos "Sem certificado" e "Certificado vencido" e incluir essas contagens no aviso final.
- Usar `update_secret` para `INFOSIMPLES_ENCRYPTION_KEY`.
