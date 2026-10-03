# Parcelamentos PGFN

## Estado atual
- Cadastro **manual** de negociações por empresa (aba Fiscal > Parcelamentos > PGFN).
- Indicador fixo: "Sincronização automática não configurada". Nenhum dado é consultado na PGFN.
- Emissão de guia: botão abre o SISPAR oficial da PGFN
  (https://sisparnet.pgfn.fazenda.gov.br/sisparInternet/internet/darf/consultaParcelamentoDarfInternet.xhtml)
  em nova aba (`noopener`). O PDF baixado é anexado manualmente (bucket privado `documents`, caminho `pgfn/{client_id}/{registro}/`).
- Envio por WhatsApp: janela de revisão; o arquivo é compartilhado por link temporário (7 dias).
- Situação da Dívida Ativa no SITFIS **não** é tratada como lista de parcelamentos.

## Estrutura do registro
Tabela `parcelamento_results`, `origem='PGFN'`, `modalidade='PGFN_MANUAL'`, `status='success'`.
Campos extras em `raw_response` (ver `src/lib/pgfnNegociacao.ts`): `fonte:'manual'`, `schema:1`,
`valor_proxima_parcela`, `vencimento_proxima`, `observacoes`, `atualizado_manual_em`, `atualizado_por`, `guia`.

## Regras
- Número obrigatório; valores ≥ 0; pagas ≤ total; vazio = "Não informado".
- Duplicata = empresa + origem PGFN + número normalizado (checagem no app; índice único no banco pendente).
- Valor consolidado não é saldo devedor.
- Acesso: o mesmo padrão efetivo do projeto (usuário autenticado com leitura da empresa via RLS de `clients`). O isolamento por escritório (supabase/multitenant) ainda não está aplicado.

## Próximo passo real para automação
1. Confirmar um conector autenticado com documentação pública de consulta de negociações/parcelas/DARF PGFN
   (ex.: Infosimples — issue 602 ainda aberta; não há serviço confirmado).
2. Ou um proxy próprio mantido pelo escritório, com contrato definido e testado no portal oficial, usando o certificado do cliente
   com procuração PGFN. Nunca coletar senha gov.br.
3. Só depois criar a função do servidor, gravando com `fonte` diferente de `manual`.
