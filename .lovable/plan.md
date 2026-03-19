

# Atualizar Catálogo Integra Contador com Documentação Oficial

## Resumo

O catálogo de serviços (`SERVICE_CATALOG`) em `IntegraContador.tsx` já cobre todos os sistemas documentados nos PDFs. Os IDs de serviço e modalidades de parcelamento estão corretos. Porém, alguns serviços têm campos de entrada incorretos que não correspondem ao que a API espera.

## Correções Necessárias

### 1. PGDASD - Campos incorretos

| Serviço | Campo atual | Campo correto (da doc) |
|---|---|---|
| `CONSDECLARACAO13` | PA | `anoCalendario` (string "2018") |
| `CONSDECREC15` | PA | `numeroDeclaracao` (string "00000000201801001") |
| `CONSEXTRATO16` | PA | `numeroDas` (string "07202136999997159") |
| `GERARDASPROCESSO18` | PA | `numeroProcesso` (string "00000000000000000") |
| `GERARDASAVULSO19` | PA | `PeriodoApuracao` (int 202401) + `ListaTributos` (array complexo) |
| `GERARDASCOBRANCA17` | PA | `periodoApuracao` (AAAAMM) - campo OK mas precisa confirmar nome |

### 2. PGMEI - Campos incorretos

| Serviço | Campo atual | Campo correto (da doc) |
|---|---|---|
| `ATUBENEFICIO23` | CNPJ apenas | `anoCalendario` + `infoBeneficio` (array de PA+indicador) |
| `DIVIDAATIVA24` | CNPJ apenas | `anoCalendario` (string "2020") |

### 3. Parcelamentos - Campo para OBTERPARC e DETPAGTOPARC

A `parcServices` helper usa `F_NUM_PEDIDO` (numeroPedido) para todos, mas:
- `OBTERPARC*` espera `numeroParcelamento` (int)
- `DETPAGTOPARC*` espera `numeroParcelamento` + `anoMesParcela` (AAAAMM)
- `GERARDAS*` (parcelamento) espera `parcelaParaEmitir` (int AAAAMM)
- `PEDIDOSPARC*` e `PARCELASPARAGERAR*` enviam `dados: ""` (sem campos extras)

## Alterações no Código

### Arquivo: `src/pages/IntegraContador.tsx`

**a) Adicionar novos campos auxiliares** (junto aos existentes F_CNPJ, F_PA, etc.):
- `F_NUM_DECLARACAO` = { key: 'numeroDeclaracao', label: 'Nº Declaração', required: true }
- `F_NUM_DAS` = { key: 'numeroDas', label: 'Nº DAS', required: true }
- `F_NUM_PROCESSO` = { key: 'numeroProcesso', label: 'Nº Processo', required: true }
- `F_NUM_PARCELAMENTO` = { key: 'numeroParcelamento', label: 'Nº Parcelamento', required: true }
- `F_ANOMES_PARCELA` = { key: 'anoMesParcela', label: 'Ano/Mês Parcela (AAAAMM)', required: true }
- `F_PARCELA_EMITIR` = { key: 'parcelaParaEmitir', label: 'Parcela p/ Emitir (AAAAMM)', required: true }

**b) Corrigir campos nos serviços PGDASD:**
- `CONSDECLARACAO13`: fields → [F_CNPJ, F_ANO]
- `CONSDECREC15`: fields → [F_CNPJ, F_NUM_DECLARACAO]
- `CONSEXTRATO16`: fields → [F_CNPJ, F_NUM_DAS]
- `GERARDASPROCESSO18`: fields → [F_CNPJ, F_NUM_PROCESSO]

**c) Corrigir campos nos serviços PGMEI:**
- `DIVIDAATIVA24`: fields → [F_CNPJ, F_ANO]

**d) Refatorar `parcServices` para usar campos corretos por tipo de serviço:**
- `GERARDAS*` → fields: [F_CNPJ, F_PARCELA_EMITIR]
- `PARCELASPARAGERAR*` → fields: [F_CNPJ] (sem dados extras)
- `PEDIDOSPARC*` → fields: [F_CNPJ] (sem dados extras)
- `OBTERPARC*` → fields: [F_CNPJ, F_NUM_PARCELAMENTO]
- `DETPAGTOPARC*` → fields: [F_CNPJ, F_NUM_PARCELAMENTO, F_ANOMES_PARCELA]

## O que NÃO muda

- Todos os IDs de sistema e serviço estão corretos
- A estrutura de categorias/abas permanece igual
- A lógica de `handleSubmit` e a edge function `integra-contador` não precisam de alteração
- Os parcelamentos RELPSN e RELPMEI permanecem (não havia docs, mas seguem o mesmo padrão)

