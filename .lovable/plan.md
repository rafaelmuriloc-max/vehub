

# Plano: Buscar notas de todos os clientes quando nenhum estiver selecionado

## Mudança

Atualmente o `handleSync` exige um cliente selecionado. Quando nenhum cliente estiver selecionado, iterar sobre todos os clientes que possuem certificado digital (`digital_certificate_url`) e chamar o `nfse-query` para cada um sequencialmente.

## Implementação em `src/pages/Invoices.tsx`

1. **Remover validação obrigatória de cliente** no `handleSync` — se `selectedClient` estiver vazio, buscar de todos
2. **Lógica de sync em lote**: quando `selectedClient` vazio, filtrar `clients` que têm `document` (CNPJ), iterar sequencialmente chamando `nfse-query` para cada `client_id`, acumulando resultados e erros
3. **Feedback de progresso**: mostrar toast com progresso ("Consultando 3/15...") e ao final resumir quantos foram consultados com sucesso vs falhas
4. **Ajustar placeholder do Select** para indicar que "todos" serão consultados quando vazio — adicionar um `SelectItem` com valor vazio: "Todos os clientes"

### Estrutura do handleSync atualizado

```text
handleSync():
  if !referenceMonth → toast erro
  clientIds = selectedClient ? [selectedClient] : clients.filter(c => c.document).map(c => c.id)
  for each clientId:
    invoke nfse-query({ client_id, reference_month })
    track success/error count
  loadInvoices()
  toast resumo
```

## Arquivo

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/Invoices.tsx` — ajustar `handleSync` e Select de cliente |

