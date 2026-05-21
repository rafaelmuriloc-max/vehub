## Abas RFB e PGFN dentro de Parcelamentos

Reorganizar o `ParcelamentosTab` em duas sub-abas (`Tabs` do shadcn) com a mesma UX (busca, filtros, seleção em massa, tabela, diálogo de detalhes), trocando apenas a fonte dos dados.

### 1. Estrutura visual

`src/components/integra-contador/ParcelamentosTab.tsx`

```text
ParcelamentosTab
└── Tabs (defaultValue="rfb")
    ├── TabsList: [RFB | PGFN]
    ├── TabsContent value="rfb"  → <RfbParcelamentos />
    └── TabsContent value="pgfn" → <PgfnParcelamentos />
```

Extrair o conteúdo atual para um componente `RfbParcelamentos` (lógica intacta — Integra Contador SERPRO, 8 modalidades RFB). Criar `PgfnParcelamentos` em arquivo irmão.

### 2. Aba PGFN — integração via REGULARIZE

O portal REGULARIZE (https://www.regularize.pgfn.gov.br) exige login com e-CNPJ ICP-Brasil ou gov.br e não tem API pública. A automação será feita por **edge function que faz scraping autenticado via proxy** usando o mesmo padrão já usado para NFe:

- Nova edge function `pgfn-parcelamentos`
  - Recebe `client_id`
  - Carrega o certificado A1 do cliente da tabela `digital_certificates`
  - Encaminha para o proxy PHP da Hostinger (`PGFN_PROXY_URL`, novo secret) que executa o login mTLS no REGULARIZE e devolve a lista de parcelamentos em aberto + parcelas pendentes
  - Persiste em nova tabela `pgfn_parcelamento_results` espelhando `parcelamento_results`
- Nova tabela `pgfn_parcelamento_results` (mesmo shape: client_id, modalidade, numero, situacao, data_pedido, valor_total, parcelas_pagas, parcelas_total, raw_response, status, error_message, consulted_at) com RLS idêntica.
- Modalidades PGFN exibidas: "Negociação PGFN" (genérica) + as que o scraper conseguir identificar (Ordinário, ATD, NDP, NDF, Transação Excepcional).
- Botão "Gerar guia" abre o DARF/DAS retornado pelo proxy em PDF base64.

### 3. Pré-requisitos (bloqueantes para PGFN funcionar)

1. Hospedar script PHP no proxy Hostinger que faça login no REGULARIZE com o certificado e exponha endpoints `/parcelamentos` e `/parcela-guia`.
2. Criar secret `PGFN_PROXY_URL` e `PGFN_PROXY_TOKEN`.
3. Aplicar migração da tabela `pgfn_parcelamento_results`.

Sem o item 1, a aba PGFN ficará renderizada mas a consulta retornará erro "Proxy PGFN não configurado". O scraping em si depende de engenharia externa (PHP + cURL com `--cert`) fora do código React/Edge.

### Arquivos afetados

- `src/components/integra-contador/ParcelamentosTab.tsx` — wrapper com Tabs
- `src/components/integra-contador/RfbParcelamentos.tsx` — novo (move conteúdo atual)
- `src/components/integra-contador/PgfnParcelamentos.tsx` — novo
- `supabase/functions/pgfn-parcelamentos/index.ts` — novo
- migração: `pgfn_parcelamento_results` + RLS
- secrets: `PGFN_PROXY_URL`, `PGFN_PROXY_TOKEN`

### Observação importante

Reforço que **não existe API oficial PGFN**; toda automação depende de manter um proxy PHP que faz scraping autenticado no REGULARIZE. Se o portal mudar, quebra. Alternativa mais robusta é deixar PGFN como entrada manual — posso refazer o plano nesse formato se preferir.
