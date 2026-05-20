## Mudança

Adicionar a coluna **Regime Tributário** na tabela de clientes (`src/pages/Clients.tsx`, tabela desktop em ~linha 1373).

- Inserir `<TableHead>Regime</TableHead>` entre "Documento" e "Contato".
- Inserir `<TableCell>` correspondente usando `taxRegimeLabels[c.tax_regime || '']` (mapa já existente no arquivo) com fallback "—" quando vazio. Exibir como `Badge` discreto (variant `outline`) para destacar.
- Atualizar `colSpan={8}` da linha "Nenhum cliente encontrado" para `9`.

Sem mudanças no banco nem em mobile (cards continuam iguais).
