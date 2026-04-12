
# Corrigir campo do Relatório de Situação Fiscal (SITFIS)

## Problema

O serviço RELATORIOSITFIS92 usa `F_PROTOCOLO` que tem key `protocolo`, mas a API SERPRO espera `protocoloRelatorio` no payload `dados`.

## Solução

Alterar o campo do serviço RELATORIOSITFIS92 para usar a key correta `protocoloRelatorio`.

### Mudança (linha 156)

```typescript
// Antes:
fields: [F_PROTOCOLO]

// Depois:
fields: [{ key: 'protocoloRelatorio', label: 'Protocolo do Relatório', required: true, placeholder: '' }]
```

## Arquivo

| Arquivo | Mudança |
|---------|--------|
| `src/pages/IntegraContador.tsx` | Linha 156 — trocar `F_PROTOCOLO` por campo com key `protocoloRelatorio` |

## Nota

Os serviços SITFIS já estão registrados no catálogo (categoria `situacaofiscal`). A Edge Function já suporta os tipos `Apoiar` e `Emitir` usados por esses serviços. A única correção necessária é o nome do campo.
