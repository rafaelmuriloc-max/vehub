## Sincronização de NF-e de saída via Web Service SEF-SC (nfeDownloadContab)

A SEF-SC oferece o serviço `NfeDownload / nfeDownloadContab` — SOAP nativo, mTLS com e-CNPJ ICP-Brasil, equivalente ao `NFeDistribuicaoDFe` federal, **com filtro de papel** (`indAtor`) que permite baixar NF-e onde o CNPJ é **emitente** (saídas), **destinatário** (entradas) ou ambos. Resolve o caso de NF-e de saída sem upload manual nem scraping.

Restrições oficiais (Boletim Técnico SC-2021-001):
- `cUF=42` fixo, certificado da Velocità precisa estar **vinculado ao CNPJ consultado** (procuração estadual no SAT-SC — gestão operacional, fora do código)
- Atraso mínimo de 24h para entrega de DF-e
- Espera mínima de 12h entre sincronizações completas do mesmo CNPJ
- TLS 1.2 obrigatório, gzip, ICP-Brasil

### Arquitetura

Mesmo padrão da sincronização federal atual: edge function chama proxy PHP na Hostinger (já tem o A1 da Velocità configurado e IP liberado). A edge function **não fala SOAP direto** — Supabase bloqueia mTLS de saída.

```text
NfeTab (UI) → Edge nfe-query → Hostinger proxy (PHP+cURL+A1) → SEF-SC SOAP
                                                              ↓
                                              retDistNFeSC (lote distNFeSC com nfeProc/procEventoNFe)
```

### Mudanças

**1. Proxy Hostinger (`.lovable/tmp/proxy-nfe.php` referência → arquivo real no VPS)**
- Adicionar handler `provider=sefaz-sc` que monta o envelope SOAP `nfeDownloadContab` e faz POST em `https://satnfe.sef.sc.gov.br/ws/distribuicao/nfedownloadV2.asmx` com cert A1 da Velocità (mesmo `.pfx` já usado).
- Body do payload do proxy:
  ```json
  { "provider": "sefaz-sc", "cnpj": "01234567000199", "ind_ator": 1, "ult_nsu": "0" }
  ```
- Resposta: XML cru `retDistNFeSC` (deixa parsing pra edge).

**2. Edge function `supabase/functions/nfe-query/index.ts`**
- Novo parâmetro no body: `provider: 'an' | 'sefaz-sc'` (default `an` mantém comportamento atual).
- Quando `provider='sefaz-sc'`:
  - Validar que o cliente tem UF=SC (descartar com erro amigável se não).
  - Loop de NSU: chamar proxy com `ind_ator=9` (emitente E destinatário) e `ult_nsu` partindo de `clients.last_sefazsc_nsu` (novo campo) ou 0 se busca por período.
  - Reusar `parseNfeEntry` adaptando o namespace (`http://www.satnfe.sef.sc.gov.br/ws/distribuicao-v2`) — a estrutura interna `<distNFeSC NSU=… chAcesso=…><nfeProc>…</nfeProc></distNFeSC>` é praticamente idêntica.
  - Determinar `direction` corretamente: se `emit/CNPJ` digits == `clients.document` digits → `'saida'`, senão `'entrada'`.
  - Aplicar mesmo filtro de período já implementado.
  - Atualizar `clients.last_sefazsc_nsu` ao final (apenas em sync incremental, não em busca por período).

**3. Migration**
- `ALTER TABLE clients ADD COLUMN last_sefazsc_nsu text;` (cursor próprio para SEF-SC, separado do `last_nfe_nsu` do AN).

**4. UI `src/components/invoices/NfeTab.tsx`**
- No card "Consultar NF-e", adicionar select **"Origem"** com:
  - **Ambiente Nacional (AN)** — comportamento atual; só entradas.
  - **SEF-SC (entradas + saídas)** — habilitado apenas se o cliente selecionado tiver UF=SC.
- Mostrar aviso quando SEF-SC for selecionado: "Requer procuração ativa no SAT-SC para o CNPJ da Velocità no cliente."
- Manter botão de upload manual de XML como fallback (planejado anteriormente).

### Fora de escopo (não fazer agora)

- Procuração SAT-SC programática (não tem API; gestão manual).
- Cobrir outros estados — cada SEFAZ tem (ou não) seu próprio serviço.
- Integração com ERPs (Bling/Tiny/Omie) — pode vir depois para clientes fora de SC.

### Pré-requisitos operacionais (lembrete pro usuário)

1. Cadastrar a Velocità como **procurador no SAT-SC** para cada cliente catarinense (pelo próprio cliente, no portal SAT). Sem isso, SEF-SC retorna 252/280 (não autorizado).
2. Confirmar que o A1 da Velocità no proxy Hostinger é e-CNPJ ICP-Brasil válido (já está, é o mesmo do `distDFe`).
