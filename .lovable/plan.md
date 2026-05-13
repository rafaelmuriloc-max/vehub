## Resumo
Substituir o iframe do Monitor Contábil na página Fiscal pela aba "Situação Fiscal" atualmente dentro do Integra Contador. Remover a aba de dentro do Integra Contador, simplificando-o.

## Passos

### 1. `src/pages/Fiscal.tsx`
- Remover todo o conteúdo do iframe do Monitor Contábil.
- Importar e renderizar `SituacaoFiscalTab`.
- Adicionar título e descrição da página.

### 2. `src/pages/IntegraContador.tsx`
- Remover a aba `sitfis` do `TabsList` e o `<TabsContent value="sitfis">`.
- Como resta apenas a aba "Serviços", remover completamente o componente `Tabs` e deixar o conteúdo renderizado diretamente.
- Remover o import do `SituacaoFiscalTab` e os ícones que deixam de ser usados (`Shield`).

### 3. `src/App.tsx`
- Sem alterações nas rotas — `/fiscal` e `/integra-contador` continuam existindo.

## Detalhes Técnicos
- O componente `SituacaoFiscalTab` é auto-suficiente: busca seus próprios dados no Supabase (`clients` + `sitfis_results`) e não depende de props ou contexto do `IntegraContador`.
- A aba de Situação Fiscal dentro do Integra Contador usa `<SituacaoFiscalTab />` sem props — pode ser movida diretamente para `Fiscal.tsx`.
