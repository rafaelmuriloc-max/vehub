# Parcelamentos PGFN: diagnóstico e caminho para implementar

## O que existe hoje (verificado)
- **Tela PGFN**: `src/components/integra-contador/PgfnParcelamentos.tsx` tem 40 linhas e é só um aviso fixo ("em construção", link do REGULARIZE). Não consulta nada nem grava dados.
- **Proxy `PGFN_PROXY_URL`**: só aparece nesse texto. Não está nas chaves salvas, nenhuma função do servidor usa e não existe contrato definido. As únicas chaves de proxy configuradas são `NFE_PROXY_URL` e `NFE_PROXY_TOKEN`, usadas pelo proxy Hostinger das NF-e.
- **Tabela `parcelamento_results`**: aceita `origem IN ('RFB','PGFN')` (migração 20260521144717). A migração 20260521174701 apagou todas as linhas PGFN e `OBTERPARC24*`, porque a tentativa via SERPRO (sistema `PARCMEPN`) retornou "Identificação do sistema ou serviço inválida".
- **Acesso aos dados**: pelo plano já aprovado, qualquer usuário logado lê e grava. A tabela está na lista de isolamento por escritório (`supabase/multitenant/002–004`), que ainda **não foi aplicada** em produção.
- **O que já mostra algo da PGFN**: o relatório SITFIS (`sitfis_results`, lido por `sitfisParser.ts`) tem a seção "Diagnóstico Fiscal na Procuradoria". Ela mostra só se há pendência na PGFN e, quando aparecem, parcelamentos citados no texto. Isso é **situação na Dívida Ativa, não a lista de negociações com parcelas** — não serve como fonte de parcelamentos.
- **Chaves e conectores presentes (só nomes)**: SERPRO_CONSUMER_KEY/SECRET, INFOSIMPLES_API_TOKEN/ENCRYPTION_KEY, NFE_PROXY_URL/TOKEN, EVOLUTION_*, WHATSAPP_*, ASAAS_*, Gmail, Drive, Sheets e Firecrawl (não ligado). **Nenhuma credencial do REGULARIZE/PGFN**.
- **Backend**: Supabase externo `ismgjjvarzzfsbdpthot`. Funções do servidor só são publicadas com sua autorização.

## O que não existe (bloqueios externos)
1. O Integra Contador/SERPRO não tem serviço de parcelamentos PGFN.
2. Não há API pública conhecida do REGULARIZE para listar negociações, parcelas ou emitir DARF de parcela. Não vou supor nenhum endereço oficial.
3. O SISPAR é um sistema da RFB, não da PGFN; os parcelamentos não Simples da RFB também não estão no Integra Contador.
4. O REGULARIZE pede login gov.br ou certificado digital com procuração da PGFN. Ela é separada da procuração e-CAC e precisa ser conferida por empresa.
5. Automação de portal (robô) pode quebrar com captcha, mudanças de tela e limites de uso.

## Caminhos viáveis (precisa da sua escolha)
- **A. Provedor terceirizado (recomendado avaliar primeiro)**: confirmar no catálogo da Infosimples (token já existe) se há consulta de parcelamentos e emissão de guia PGFN/REGULARIZE com certificado. Se houver, eu leio a documentação oficial deles antes de escrever código, igual ao que fizemos no FGTS.
- **B. Proxy próprio (robô no REGULARIZE)**: um servidor seu (como o da Hostinger) com o certificado A1 de cada cliente. Exige definir o contrato abaixo e alguém para manter o robô.
- **C. Controle manual**: cadastrar o parcelamento PGFN (número, modalidade, parcelas, valor e vencimento), anexar o DARF baixado do REGULARIZE e enviar por WhatsApp pela tela atual. Funciona hoje, sem depender de terceiros.

## Contrato proposto para o proxy (caminho B, ainda não existe)
```text
POST {PGFN_PROXY_URL}/negociacoes   Authorization: Bearer PGFN_PROXY_TOKEN
  { cnpj, cert_pfx_base64, cert_password }
  -> { negociacoes: [{ numero, modalidade, situacao, data_adesao, valor_consolidado,
                        parcelas_total, parcelas_pagas, proximo_vencimento }] }
POST {PGFN_PROXY_URL}/parcelas      { cnpj, cert..., numero } -> { parcelas: [{ numero, vencimento, valor, situacao }] }
POST {PGFN_PROXY_URL}/darf          { cnpj, cert..., numero, parcela } -> { pdf_base64, linha_digitavel, vencimento }
```

## Implementação nesta sessão (depois da escolha)
- Função do servidor `pgfn-parcelamentos` que verifica o usuário e chama o provedor escolhido. Ela grava em `parcelamento_results` com `origem='PGFN'` e a resposta original em `raw_response`, e devolve o PDF da guia.
- `PgfnParcelamentos.tsx` no mesmo visual da aba RFB: cartões por empresa, parcelas pagas, Gerar parcela e Enviar via WhatsApp, reaproveitando a lógica de envio já feita.
- Caminho C: formulário de cadastro manual e envio do PDF anexado. Nenhuma mudança no banco é necessária, porque a tabela já aceita PGFN.
- Publicar a função só com sua autorização.

## Arquivos relevantes
- `src/components/integra-contador/PgfnParcelamentos.tsx`, `ParcelamentosTab.tsx`, `RfbParcelamentos.tsx`
- `src/components/integra-contador/sitfisParser.ts`, `SitfisDetailPanel.tsx`, `SituacaoFiscalTab.tsx`
- `supabase/functions/integra-contador/index.ts`, `supabase/functions/_shared/certificate.ts`, `supabase/functions/fgts-digital-sync/index.ts` (modelo Infosimples)
- `supabase/migrations/20260521144717_*.sql`, `20260521174701_*.sql`, `supabase/multitenant/002–004`

## Preciso de você
1. Qual caminho seguir: A, B ou C (ou C agora e A/B depois)?
2. Para o B: o endereço do servidor e quem vai hospedar o robô.
3. As empresas têm procuração na PGFN (não só no e-CAC)?
