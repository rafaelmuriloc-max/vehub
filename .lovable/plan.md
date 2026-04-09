

# Remover cnpjBasico do campo `dados` dos serviços PGDASD e outros

## Problema
O exemplo oficial do SERPRO mostra claramente:
```json
"dados": "{ \"periodoApuracao\": \"201801\" }"
```
Sem `cnpjBasico` dentro de `dados`. O CNPJ já é enviado em `contribuinte.numero` no body principal (feito pela edge function). Incluir `cnpjBasico` dentro de `dados` causa erros de "parâmetro inválido".

## Serviços afetados
Todos os serviços que atualmente incluem `F_CNPJ` nos `fields` mas que, segundo a documentação, não devem ter `cnpjBasico` em `dados`:

**PGDASD**: GERARDAS12, CONSDECLARACAO13, CONSULTIMADECREC14, CONSDECREC15, CONSEXTRATO16, GERARDASCOBRANCA17, GERARDASPROCESSO18, GERARDASAVULSO19, TRANSDECLARACAO11

**PGMEI**: GERARDASPDF21, GERARDASCODBARRA22, ATUBENEFICIO23, DIVIDAATIVA24

**CCMEI**: EMITIRCCMEI121, DADOSCCMEI122

**DCTFWEB**: todos (31-313)

**MIT**: todos (314-317)

**DEFIS**: todos (141-144)

**REGIMEAPURACAO**: todos (101-104)

**SITFIS**: SOLICITARPROTOCOLO91, RELATORIOSITFIS92

**PROCURACOES**: OBTERPROCURACAO41

**AUTENTICAPROCURADOR**: ENVIOXMLASSINADO81

**EVENTOSATUALIZACAO**: todos (131-134)

**DTE**: CONSULTASITUACAODTE111

**CAIXAPOSTAL**: MSGCONTRIBUINTE61, etc (sem cnpjBasico nos dados)

**PAGTOWEB**: MANTER `F_CNPJ` — a documentação mostra `cnpjBasico` dentro de `dados` para este sistema.

**SICALC**: MANTER `F_CNPJ` — verificar no PDF, mas provavelmente precisa.

**Parcelamentos** (parcServices): MANTER `F_CNPJ` — estes sistemas podem precisar.

## Alterações

### `src/pages/IntegraContador.tsx`
Remover `F_CNPJ` dos arrays `fields` dos serviços listados acima. O campo `cnpjBasico` ficará apenas nos serviços PAGTOWEB, SICALC e parcelamentos.

Exemplo de mudança:
```typescript
// Antes:
fields: [F_CNPJ, F_PERIODO]
// Depois:
fields: [F_PERIODO]
```

São ~40 linhas de edição (remover `F_CNPJ,` de cada serviço afetado).

## Resultado esperado
O campo `dados` enviado ao SERPRO conterá apenas os parâmetros específicos do serviço, sem duplicar o CNPJ que já vai automaticamente em `contribuinte.numero`.

