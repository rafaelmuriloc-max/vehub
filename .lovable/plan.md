

# Plano: Integração com API Integra Contador (SERPRO)

## Visão Geral

Integrar a API Integra Contador do SERPRO para acessar serviços fiscais da Receita Federal diretamente no sistema. A API usa autenticação OAuth2 com certificado digital e-CNPJ (mTLS), padrão já implementado nas edge functions de NFS-e.

## Pré-requisitos

Você precisará fornecer:
1. **Consumer Key** e **Consumer Secret** da Loja SERPRO (serão armazenados como secrets)
2. **CNPJ do contratante** (cadastrado na empresa)
3. **Certificado digital e-CNPJ** (.p12/.pfx) — já suportado pelo sistema via storage bucket `certificates`

## Arquitetura

```text
Frontend (React)          Edge Function              SERPRO API
─────────────────       ──────────────────       ─────────────────
Página "Integra        → integra-contador/      → autenticacao.sapi
 Contador"                index.ts                  .serpro.gov.br
                           │                         /authenticate
 - Seleciona serviço       ├─ Autentica OAuth2    → gateway.apiserpro
 - Seleciona cliente       │  com mTLS (cert)       .serpro.gov.br
 - Visualiza resultado     ├─ Obtém Bearer+JWT      /integra-contador
                           ├─ Chama serviço          /v1/{tipo}
                           └─ Retorna resultado
```

## Implementação

### 1. Secrets (2 novos)
- `SERPRO_CONSUMER_KEY` — Consumer Key da Loja SERPRO
- `SERPRO_CONSUMER_SECRET` — Consumer Secret da Loja SERPRO

### 2. Edge Function `integra-contador/index.ts`
Nova edge function que:
- Recebe: `client_id`, `idSistema`, `idServico`, `tipo` (Consultar/Emitir/Declarar/Apoiar/Monitorar), `dados` (JSON string)
- Baixa o certificado digital do cliente do Storage (reutilizando o padrão de `nfse-query`)
- Parseia o .p12 com `node-forge` (mesmo padrão)
- Autentica via OAuth2 com mTLS em `https://autenticacao.sapi.serpro.gov.br/authenticate`
- Chama o serviço requisitado via POST em `https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/{tipo}` com Bearer + JWT tokens
- Retorna o resultado ao frontend

**Body padrão SERPRO:**
```json
{
  "contratante": { "numero": "CNPJ_CONTRATANTE", "tipo": 2 },
  "autorPedidoDados": { "numero": "CNPJ_CONTRATANTE", "tipo": 2 },
  "contribuinte": { "numero": "CNPJ_CLIENTE", "tipo": 2 },
  "pedidoDados": {
    "idSistema": "PGDASD",
    "idServico": "CONSDECLARACAO13",
    "versaoSistema": "1.0",
    "dados": "{\"cnpjBasico\": \"12345678\", ...}"
  }
}
```

### 3. Nova página `src/pages/IntegraContador.tsx`
Interface com:
- Select de cliente (com CNPJ e certificado configurado)
- Agrupamento dos serviços por categoria (SN, MEI, DCTFWeb, Sicalc, etc.)
- Select do serviço desejado (com descrição)
- Formulário dinâmico para os campos de `dados` do serviço selecionado
- Área de resultado (JSON formatado ou tabela)
- Loading state e tratamento de erros

### 4. Rota e Menu
- Rota `/integra-contador` em `App.tsx`
- Item "Integra Contador" no sidebar (grupo Administração ou menu principal), ícone `Plug` ou `Link`

### 5. Config TOML
```toml
[functions.integra-contador]
verify_jwt = false
```

## Catálogo de Serviços Disponíveis (principais)

Os serviços serão mapeados no frontend com seus `idSistema`/`idServico`:
- **Simples Nacional**: PGDASD (declarações, DAS, extrato)
- **MEI**: PGMEI (DAS PDF, código de barras, dívida ativa)
- **DCTFWeb**: DCTFWEB (guia, recibo, declaração)
- **Sicalc**: SICALC (DARF, receitas)
- **Caixa Postal**: CAIXAPOSTAL (mensagens RFB)
- **Pagamentos**: PAGTOWEB (consulta pagamentos)
- **Situação Fiscal**: SITUACAOFISCAL (pendências, regularidade)
- **Procurações**: PROCURACOES (consulta)

## Detalhes Técnicos

- Reutiliza `parsePfx`, `requestWithFetchHttp1`, `sendRawHttpRequestOverTls` do padrão `nfse-query` (copiado para a nova function)
- Autenticação SERPRO requer mTLS no endpoint de token (diferente do ADN que usa mTLS direto)
- Token tem validade curta (~33 min), será obtido a cada requisição (sem cache entre invocações)
- A edge function valida o usuário autenticado via Supabase auth

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/functions/integra-contador/index.ts` |
| Criar | `src/pages/IntegraContador.tsx` |
| Editar | `src/App.tsx` (nova rota) |
| Editar | `src/components/AppSidebar.tsx` (menu) |
| Editar | `supabase/config.toml` (jwt config) |
| Secrets | `SERPRO_CONSUMER_KEY`, `SERPRO_CONSUMER_SECRET` |

