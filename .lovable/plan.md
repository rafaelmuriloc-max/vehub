# Ligar o FGTS Digital à Infosimples e rodar agosto/2026

## O que será feito
1. **Corrigir o envio do certificado.** A documentação da Infosimples diz que o certificado A1 e a senha precisam ir criptografados conforme as instruções de criptografia dela. Hoje enviamos o arquivo sem criptografia. Vou ler essas instruções e aplicar a criptografia. Se ela precisar de uma chave própria da conta Infosimples, vou pedir essa chave num formulário seguro.
2. **Confirmar o endereço da consulta** (`fgts/guia`) e os campos que voltam, comparando com a documentação oficial da consulta.
3. **Publicar a consulta no servidor.** Esta mensagem conta como sua autorização para publicar **só esta função**.
4. **Testar com 1 empresa** de agosto/2026 primeiro. Se der erro de certificado, procuração ou login, eu corrijo antes de continuar.
5. **Rodar agosto/2026 para todas as empresas ativas**, uma por vez, e gravar o resultado no painel.
6. **Relatório no chat:** total de empresas consultadas, total de guias que vieram, lista das guias **não pagas** (empresa, nº da guia, vencimento, valor) e as empresas que deram erro, com o motivo de cada uma.

## Pontos de atenção
- **Custo:** cada empresa consultada gera uma cobrança na Infosimples. A rodada completa equivale a uma consulta por empresa ativa.
- **Procuração:** o certificado do escritório precisa ter procuração no FGTS Digital para cada empresa. As empresas sem procuração vão aparecer como erro.
- **Situação "não paga":** a guia conta como não paga quando não tem data de arrecadação e a situação dela não indica pagamento.

## Detalhes técnicos
- Docs: `https://api.infosimples.com/consultas/docs/pt-BR/fgts/guia.md` e a página de criptografia (os parâmetros encriptáveis são `pkcs12_cert` e `pkcs12_pass`).
- Ajustar `supabase/functions/fgts-digital-sync/index.ts`: criptografar os dois parâmetros e incluir `[functions.fgts-digital-sync] verify_jwt = false` no config.
- A rodada completa será disparada por um script que chama a função com um token de usuário válido. Os dados virão de uma consulta em `fgts_digital_guias` com `competencia = '2026-08'`.
