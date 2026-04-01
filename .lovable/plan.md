

# Ignorar clientes sem certificado ou com certificado vencido na busca de NFS-e

## Problema
Na busca em lote (quando nenhum cliente específico é selecionado), o sistema tenta consultar todos os clientes com CNPJ, incluindo aqueles sem certificado digital ou com certificado vencido. Isso gera erros desnecessários.

## Alterações

### `src/pages/Invoices.tsx`

1. Atualizar o tipo `Client` para incluir `digital_certificate_url` e `digital_certificate_expiry`
2. Atualizar a query `loadClients` para buscar esses campos adicionais
3. No `handleSync`, ao montar a lista de clientes para busca em lote, filtrar apenas clientes que:
   - Possuem `document` (CNPJ)
   - Possuem `digital_certificate_url` (certificado cadastrado)
   - Possuem `digital_certificate_expiry` com data futura (não vencido)
4. Atualizar a mensagem de erro caso nenhum cliente elegível seja encontrado

### Lógica do filtro
```typescript
const today = new Date().toISOString().slice(0, 10);
clients.filter(c => 
  c.document && 
  c.digital_certificate_url && 
  c.digital_certificate_expiry && 
  c.digital_certificate_expiry >= today
)
```

