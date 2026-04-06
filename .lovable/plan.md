
# Manter cards de retenção visíveis ao filtrar por cliente

## Problema identificado
Hoje a seção de retenções só renderiza quando `hasRetentions` é `true`:

```tsx
{hasRetentions && (
```

Como `hasRetentions` depende de `retentionTotals.total > 0`, ao selecionar um cliente a seção some sempre que:
- aquele cliente não tiver retenções no conjunto filtrado, ou
- o XML da nota não trouxer os campos usados em `parseRetentions()`.

Isso faz o bloco desaparecer, em vez de continuar visível no contexto do cliente selecionado.

## Ajuste proposto
No `src/components/invoices/NfseTab.tsx`:

1. Alterar a condição de exibição da seção de retenções para:
   - aparecer sempre quando houver um cliente selecionado, mesmo com total zerado
   - continuar aparecendo normalmente quando houver retenções reais

   Exemplo:
   ```tsx
   const showRetentionCards = filterClient !== 'all' || hasRetentions;
   ```

2. Usar essa flag no render:
   ```tsx
   {showRetentionCards && (
   ```

3. Manter o cálculo de `retentionTotals` baseado em `tomadosInvoices` derivados de `baseFiltered`, para que os valores continuem refletindo o cliente/período selecionado e não o filtro visual de tipo.

4. Ajustar o conteúdo dos cards para dois cenários:
   - **com retenção**: exibir os cards atuais normalmente
   - **sem retenção para o cliente selecionado**: exibir o card “Total Retido” com `R$ 0,00` e os demais cards zerados ou uma mensagem curta como “Sem retenções identificadas nas notas tomadas deste cliente”

## Resultado esperado
Ao selecionar um cliente:
- os cards de retenção não somem
- os valores exibidos passam a refletir apenas esse cliente
- se não houver retenções, a interface continua mostrando a seção, deixando claro que o valor é zero em vez de desaparecer

## Arquivo
- `src/components/invoices/NfseTab.tsx`

## Detalhe técnico
A filtragem já está correta:
- `baseFiltered` aplica cliente + período
- `filteredInvoices` aplica o filtro de tipo apenas na tabela
- `tomadosInvoices` usa `baseFiltered`

Então o ajuste principal é de **renderização/estado vazio** da seção de retenções, não de consulta.
