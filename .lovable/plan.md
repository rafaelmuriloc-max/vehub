# Plano B: robô próprio para negociações PGFN

## O que é
Um pequeno servidor do escritório que abre o portal oficial da PGFN (Regularize/SISPAR) como se fosse uma pessoa. Ele entra com o certificado da empresa, lê as negociações e baixa a guia. Depois devolve os dados para o sistema. Não existe API oficial: o robô só repete o que a equipe já faz à mão.

## Etapa 1 — Mapear o caminho manual (sem código, 1 a 2 dias)
Antes de programar qualquer coisa, alguém do escritório faz o processo à mão em 3 ou 4 empresas e anota cada tela:
- Como entra: certificado A1 da empresa, certificado do contador com procuração ou login gov.br. Login com senha gov.br **não** entra no robô.
- Em que tela aparece a lista de negociações e quais campos ela mostra (número, modalidade, situação, parcelas, valores).
- Como se gera o DARF da parcela no SISPAR e se aparece captcha, confirmação por celular ou limite de tentativas.
- Se a procuração na PGFN existe para cada cliente. Ela é separada da procuração no e-CAC.

**Se houver captcha ou confirmação por celular em todo acesso, o robô não é viável** e ficamos no cadastro manual. Esta etapa decide se vale continuar.

## Etapa 2 — Servidor
- Precisa ser um servidor virtual (VPS) com Linux, não a hospedagem compartilhada da Hostinger usada nas NF-e, porque o robô precisa de um navegador sem tela (Chromium/Playwright).
- Requisitos mínimos: 2 GB de memória, IP fixo no Brasil e HTTPS.
- Quem hospeda e mantém: o escritório ou um técnico contratado. Mudanças no portal vão exigir ajustes.

## Etapa 3 — Robô (no servidor, fora deste sistema)
- Recebe o pedido, abre o portal com o certificado da empresa e devolve dados estruturados. Guarda tudo só durante a consulta: não grava certificados nem senhas em disco.
- Limita o ritmo (por exemplo, 1 empresa por vez com pausas) para não ser bloqueado.
- Registra cada passo em log, sem dados sensíveis, para diagnóstico.
- Contrato proposto, a ajustar conforme o mapeamento da Etapa 1:

```text
POST /negociacoes  Authorization: Bearer PGFN_PROXY_TOKEN
  { cnpj, cert_pfx_base64, cert_password }
  -> { negociacoes: [{ numero, modalidade, situacao, data_adesao,
                       valor_consolidado, parcelas_total, parcelas_pagas,
                       valor_proxima_parcela, vencimento_proxima }] }
POST /darf         { cnpj, cert..., numero, parcela }
  -> { pdf_base64, vencimento, valor }
Erros: { erro: 'captcha' | 'sem_procuracao' | 'certificado_invalido' | 'portal_indisponivel', mensagem }
```

## Etapa 4 — Ligação com este sistema (eu faço quando o robô existir)
- Salvar `PGFN_PROXY_URL` e `PGFN_PROXY_TOKEN` nas chaves do projeto.
- Criar a função `pgfn-sync` com o mesmo modelo do FGTS. Ela verifica o usuário e pega o certificado da empresa no armazenamento privado. Depois chama o robô e grava em `parcelamento_results` (origem PGFN) com `fonte: 'robo'` e data da consulta, separado dos cadastros manuais.
- Na aba PGFN: botões "Consultar" por empresa e em lote, e "Gerar guia" que guarda o PDF no armazenamento privado. Os registros manuais continuam valendo, e o aviso "Sincronização automática não configurada" some só quando o robô responder.
- Publicar a função só com sua autorização.

## Riscos
- Mudanças no portal quebram o robô sem aviso.
- Captcha ou novas exigências de login podem inviabilizar o robô.
- O uso automatizado pode contrariar os termos de uso do portal. Vale confirmar com o jurídico ou o contador responsável.
- Custo: servidor (cerca de R$ 30 a 80 por mês) mais horas de manutenção.

## Próximo passo sugerido
Fazer a Etapa 1 e me mandar as anotações ou capturas de tela das telas. Com isso eu confirmo se dá para seguir e fecho o contrato do robô.
