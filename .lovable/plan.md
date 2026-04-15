

# Consulta de Inscrição Estadual via SAT/SC

## Problema
O campo "Inscrição Estadual" no cadastro de clientes é preenchido manualmente. Queremos automatizar a consulta usando o endpoint do SAT (Secretaria da Fazenda de SC).

## Como funciona o SAT/SC
O site é um formulário ASP.NET WebForms. Para consultar:
1. Fazer GET na página para obter tokens (`__VIEWSTATE`, `__EVENTVALIDATION`, cookies)
2. Fazer POST com o CNPJ e os tokens
3. Parsear o HTML da resposta para extrair IE e situação cadastral

## Solução

### 1. Edge Function `sat-sc-lookup`
Nova Edge Function que faz o scraping do SAT/SC:
- Recebe `{ cnpj: "XX.XXX.XXX/XXXX-XX" }` via POST
- Faz GET para obter ViewState e cookies de sessão
- Faz POST com CNPJ (apenas dígitos) para consultar
- Parseia o HTML retornado para extrair:
  - **Inscrição Estadual**
  - **Situação Cadastral** (Ativo, Baixado, Suspenso, etc.)
  - **Razão Social** (para validação)
- Retorna JSON com os dados extraídos

### 2. Botão de consulta no cadastro de clientes
Na aba Fiscal do cadastro (`Clients.tsx`), ao lado do campo "Inscrição Estadual":
- Botão com ícone de busca
- Ao clicar, chama a Edge Function passando o CNPJ do cliente
- Preenche automaticamente o campo `state_registration` com a IE retornada
- Exibe toast com a situação cadastral (ex: "Situação: Ativo")

### 3. Coluna `cadastral_status` (opcional mas recomendado)
Migration para adicionar `cadastral_status text` na tabela `clients` para persistir a situação cadastral retornada pelo SAT.

## Fluxo

```text
Usuário clica "Buscar IE"
        ↓
Frontend → Edge Function sat-sc-lookup (CNPJ)
        ↓
Edge Function → GET SAT/SC (obter ViewState + cookies)
        ↓
Edge Function → POST SAT/SC (CNPJ + ViewState)
        ↓
Edge Function → Parse HTML → { ie, situacao, razao_social }
        ↓
Frontend preenche campo IE + exibe situação cadastral
```

## Arquivos

| Arquivo | Mudança |
|---------|--------|
| `supabase/functions/sat-sc-lookup/index.ts` | Nova Edge Function para scraping do SAT/SC |
| `supabase/config.toml` | Registrar `sat-sc-lookup` com `verify_jwt = false` |
| `src/pages/Clients.tsx` | Botão de busca IE na aba Fiscal + lógica de chamada |
| Migration SQL | Adicionar `cadastral_status text` na tabela `clients` |

