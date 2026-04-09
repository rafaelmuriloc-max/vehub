

# Corrigir campos do serviço GERARGUIA31 (Gerar Guia DCTFWeb)

## Problema
O serviço GERARGUIA31 está configurado com `fields: [F_PERIODO]`, enviando `{"periodoApuracao":"202401"}`. Porém a documentação oficial mostra que os campos corretos são: `categoria`, `anoPA`, `mesPA` e `numeroReciboEntrega`.

## Solução

### Em `src/pages/IntegraContador.tsx`:

1. **Criar novos field definitions** para os campos específicos do DCTFWeb:

```typescript
const F_CATEGORIA_DCTF = { key: 'categoria', label: 'Categoria', required: true, placeholder: 'GERAL_MENSAL', options: [
  { value: 'GERAL_MENSAL', label: 'Geral Mensal' },
  { value: 'GERAL_ANUAL', label: 'Geral Anual' },
  { value: '13_SALARIO', label: '13º Salário' },
] };
const F_ANO_PA = { key: 'anoPA', label: 'Ano PA', required: true, placeholder: '2027' };
const F_MES_PA = { key: 'mesPA', label: 'Mês PA', required: true, placeholder: '11' };
const F_NUM_RECIBO = { key: 'numeroReciboEntrega', label: 'Nº Recibo Entrega', required: true, placeholder: '24573' };
```

2. **Atualizar o serviço GERARGUIA31**:
```typescript
// De:
fields: [F_PERIODO]
// Para:
fields: [F_CATEGORIA_DCTF, F_ANO_PA, F_MES_PA, F_NUM_RECIBO]
```

3. **Garantir que `numeroReciboEntrega` seja enviado como número** (não string) no `handleSubmit` — adicionar conversão para campos numéricos.

## Arquivo alterado
- `src/pages/IntegraContador.tsx` — ~10 linhas (novos fields + atualização do serviço + conversão numérica)

## Resultado esperado
O formulário exibe 4 campos (Categoria, Ano PA, Mês PA, Nº Recibo) e envia `{"categoria":"GERAL_MENSAL","anoPA":"2027","mesPA":"11","numeroReciboEntrega":24573}`.

