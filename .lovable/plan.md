

# Substituir "Nova Competência" por "Gerar Obrigações" com Tabela de Acompanhamento

## Objetivo
Trocar o botão "Nova Competência" por "Gerar Obrigações" que cria automaticamente instâncias (`obligation_instances`) para todas as obrigações vinculadas ao cliente, para cada mês restante do ano. Exibir o resultado como tabela: obrigações nas linhas, meses nas colunas, com checks para instâncias existentes.

## Mudanças

### Arquivo: `src/components/ClientObligationsTab.tsx`

1. **Carregar obrigações vinculadas ao cliente**: Fetch `client_department_obligations` filtrado por `client_id` para saber quais obrigações se aplicam ao cliente (ao invés de mostrar todas).

2. **Botão "Gerar Obrigações"**: Substitui "Nova Competência". Ao clicar:
   - Identifica os meses restantes do ano (mês atual até dezembro)
   - Para cada obrigação vinculada ao cliente, para cada mês, verifica se já existe `obligation_instance`
   - Insere em lote as instâncias faltantes
   - Recarrega os dados

3. **Tabela visual (substitui os Cards atuais)**:

```text
┌──────────────────┬──────────────┬─────┬─────┬─────┬─────┬─────┐
│ Obrigação        │ Departamento │ Mar │ Abr │ Mai │ Jun │ ... │
├──────────────────┼──────────────┼─────┼─────┼─────┼─────┼─────┤
│ DCTF Mensal      │ Fiscal       │ ✅  │ ✅  │ ✅  │ ✅  │     │
│ eSocial          │ Pessoal      │ ✅  │ ✅  │ ✅  │ ✅  │     │
│ ECD              │ Fiscal       │ ✅  │ ✅  │ ✅  │ ✅  │     │
└──────────────────┴──────────────┴─────┴─────┴─────┴─────┴─────┘
```

   - Linhas: obrigações vinculadas ao cliente (via `client_department_obligations`)
   - Coluna "Obrigação": nome
   - Coluna "Departamento": nome do departamento
   - Colunas de meses: do mês atual até dezembro do ano corrente
   - Check verde (✅) se existe `obligation_instance` para aquela obrigação+mês
   - Célula vazia se não existe
   - Clique na célula com check abre o dialog de detalhes existente

4. **Remover dialog "Nova Competência"**: Não é mais necessário, já que a geração é automática em lote.

5. **Manter dialog de detalhes**: O dialog que mostra atividades da instância continua funcionando ao clicar numa célula com check.

### Detalhes técnicos

- Fetch `client_department_obligations` para obter as obrigações do cliente
- Gerar meses: `Array.from({length: 12 - currentMonth + 1}, (_, i) => currentMonth + i)` formatados como `yyyy-MM-01`
- Bulk insert: construir array de `{obligation_id, client_id, reference_month}` para meses sem instância existente
- Usar `Table` components para a tabela
- Cada célula de mês verifica `instances.find(i => i.obligation_id === oblId && i.reference_month === monthStr)`
- Imports: adicionar `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` e `Check` icon

