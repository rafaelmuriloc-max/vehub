# Filtro de empresa por regime tributário na tela de Notas Fiscais

## O que muda
Adicionar um filtro por regime tributário nas abas ativas da tela de Notas Fiscais (NFS-e e NF-e), ao lado dos filtros de período e cliente já existentes.

## Como vai funcionar
- Novo seletor "Regime tributário" com as opções:
  - Todos
  - Não informado
  - Regimes encontrados entre os clientes listados (Simples Nacional, Lucro Presumido, Lucro Real, MEI etc.)
- O filtro se combina com:
  - Filtro de período
  - Filtro de cliente
  - Busca textual (se houver)
  - Aba ativa (Prestados/Tomados ou Entradas/Saídas)
- O filtro afeta:
  - Lista de notas exibida
  - Painéis de resumo
  - Contadores das abas
  - Downloads/exportações em lote (que já operam sobre a lista filtrada)

## Escopo técnico

### Arquivos alterados
1. `src/components/invoices/NfseTab.tsx`
2. `src/components/invoices/NfeTab.tsx`

### Mudanças em cada arquivo
1. **Carregamento de clientes**
   - Incluir `tax_regime` no `select` da query de clientes.
   - Atualizar o tipo `Client` local para incluir `tax_regime: string | null`.

2. **Estado do filtro**
   - Adicionar `filterRegime` (default `'all'`).
   - Opções do seletor montadas dinamicamente a partir dos valores distintos de `tax_regime`, incluindo `'none'` para não informado.

3. **Aplicação do filtro**
   - Aplicar `filterRegime` no `baseFiltered` antes da separação por aba.
   - Quando `filterRegime === 'none'`, manter apenas notas cujo `client_id` corresponda a um cliente com `tax_regime` vazio.

4. **Interface**
   - Inserir o seletor de regime na barra de filtros, ao lado do seletor de cliente.
   - Usar o componente `Select` existente, respeitando o layout responsivo (flex-wrap, larguras mínimas).

5. **Constantes**
   - Reutilizar `TAX_REGIME` e `normalizeTaxRegime()` de `src/lib/utils.ts` para labels e normalização, se necessário.

## Não inclui
- Alterações em banco de dados, RLS ou edge functions.
- Mudanças na aba NFC-e (ainda em construção).
- Mudanças no comportamento de sincronização/consulta ao portal.
