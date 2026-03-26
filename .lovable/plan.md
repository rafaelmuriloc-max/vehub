

# Adicionar Campo de Classificação (Comércio/Serviço/Indústria/Misto) ao Cadastro de Clientes

## Objetivo
Adicionar um novo campo `business_classification` ao cadastro de clientes que classifica automaticamente a empresa com base no CNAE principal, com opção de edição manual. Valores possíveis: Comércio, Serviço, Indústria, Misto.

## Mudanças

### 1. Migração SQL — nova coluna `business_classification`
```sql
ALTER TABLE clients ADD COLUMN business_classification text;
```

### 2. `src/pages/Clients.tsx`

- **Tipo Client**: adicionar `business_classification: string | null`
- **emptyForm**: adicionar `business_classification: ''`
- **populateForm / handleSave**: incluir o novo campo
- **Auto-classificação por CNAE**: Na função `fetchCnpjData` (e ao alterar `main_activity`), determinar automaticamente a classificação:
  - CNAEs iniciando com `47`, `45`, `46` → **Comércio**
  - CNAEs da divisão `10-33` → **Indústria**
  - Demais → **Serviço**
  - Se atividades secundárias incluem categorias diferentes da principal → **Misto**
- **Campo no formulário (aba Fiscal)**: Adicionar um `Select` com as 4 opções logo após o campo de Regime Tributário, pré-preenchido pela lógica automática mas editável manualmente

### Lógica de classificação por CNAE
```typescript
function classifyByCnae(mainCnae: string, secondaryCnaes: string): string {
  const getType = (code: string) => {
    const div = parseInt(code.substring(0, 2));
    if (div >= 10 && div <= 33) return 'industria';
    if (div >= 45 && div <= 47) return 'comercio';
    return 'servico';
  };
  const mainType = getType(mainCnae);
  // Check secondary activities for mixed classification
  const allCodes = [mainCnae];
  if (secondaryCnaes) {
    const matches = secondaryCnaes.match(/\d{7}/g);
    if (matches) allCodes.push(...matches);
  }
  const types = new Set(allCodes.map(getType));
  if (types.size > 1) return 'Misto';
  return { comercio: 'Comércio', industria: 'Indústria', servico: 'Serviço' }[mainType];
}
```

### Detalhes técnicos
- O campo é auto-preenchido ao buscar CNPJ (BrasilAPI) e ao alterar o CNAE principal, mas pode ser editado manualmente
- Sem novas dependências

