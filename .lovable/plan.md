

# Manter cards de impostos retidos visíveis ao selecionar cliente

## Problema
Os cards de impostos retidos só aparecem quando o filtro de tipo é "Todos" ou "Tomados". Quando um cliente específico é selecionado, se o filtro de tipo estiver em "Prestados", os cards desaparecem. O usuário quer que os cards de retenção sempre apareçam quando um cliente estiver selecionado, mostrando os valores daquele cliente.

## Alteração em `src/components/invoices/NfseTab.tsx`

### Linha 479 — Ajustar condição de exibição

Mudar de:
```typescript
{(filterType === 'tomados' || filterType === 'all') && hasRetentions && (
```

Para:
```typescript
{hasRetentions && (
```

Isso faz os cards de retenção aparecerem sempre que houver notas tomadas com retenções nos resultados filtrados, independentemente do filtro de tipo selecionado. Como o cálculo de `retentionTotals` já filtra apenas notas tomadas (`tomadosInvoices`), os valores sempre refletem corretamente o cliente selecionado.

**Alternativa**: Se o desejo for mostrar os cards mesmo quando `hasRetentions` é false (valores zerados) quando um cliente está selecionado, a condição seria:
```typescript
{(hasRetentions || filterClient !== 'all') && (
```

## Arquivo
- `src/components/invoices/NfseTab.tsx` — 1 linha alterada

