

# Melhorar detecção de status fiscal (Regular/Irregular)

## Problema

Atualmente, o status só é marcado como "irregular" se o JSON da resposta contiver as palavras "irregular", "pendência" ou "pendencia". Isso é insuficiente -- o relatório pode conter débitos, multas ou outras situações que indicam irregularidade sem usar essas palavras exatas.

## Solução

Expandir a verificação no `SituacaoFiscalTab.tsx` (linhas 158-162) para incluir uma lista mais abrangente de termos que indicam problemas fiscais. O status padrão será `'irregular'` e só será `'regular'` se **nenhum** dos termos negativos for encontrado.

### Mudança em `src/components/integra-contador/SituacaoFiscalTab.tsx`

Substituir o bloco de detecção (linhas 132, 158-162):

```typescript
// Default to irregular - only regular if no issues found
let fiscalStatus = 'irregular';

// ...existing PDF extraction code...

// Check for regular status - only if NO negative indicators found
const responseStr = JSON.stringify(responseData || '').toLowerCase();
const negativeIndicators = [
  'irregular',
  'pendência', 'pendencia',
  'débito', 'debito',
  'inadimplente', 'inadimplência', 'inadimplencia',
  'dívida', 'divida',
  'multa',
  'infração', 'infracao',
  'não regular', 'nao regular',
  'situação irregular', 'situacao irregular',
  'exigibilidade suspensa',
  'cobrança', 'cobranca',
  'auto de infração', 'auto de infracao',
  'omissão', 'omissao',
  'parcelamento',
];

const hasNegative = negativeIndicators.some(term => responseStr.includes(term));
if (!hasNegative) {
  fiscalStatus = 'regular';
}
```

Inversão de lógica: antes era "regular por padrão, irregular se achar palavras". Agora é **"irregular por padrão, regular só se não achar nenhum indicador negativo"**.

| Arquivo | Mudança |
|---------|--------|
| `src/components/integra-contador/SituacaoFiscalTab.tsx` | Inverter lógica de detecção + expandir lista de termos negativos |

