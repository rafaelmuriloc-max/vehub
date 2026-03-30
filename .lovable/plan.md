

# Dividir obrigações do mês em abas "A fazer" e "Concluídas"

## Resumo
Na seção "Obrigações do mês" (parte inferior da tela do calendário), substituir a lista única por duas abas usando o componente `Tabs` existente: "A fazer" mostra obrigações pendentes e "Concluídas" mostra as que tiveram todas as atividades completadas.

## Mudanças em `src/pages/CalendarView.tsx`

### 1. Importar Tabs
- Adicionar import de `Tabs, TabsList, TabsTrigger, TabsContent` de `@/components/ui/tabs`

### 2. Separar monthEvents em duas listas
- `monthEventsPending`: filtra `monthEvents` onde `isInstanceCompleted(ev.instanceId, ev.obligationId)` retorna `false`
- `monthEventsCompleted`: filtra onde retorna `true`
- Cada lista com paginação independente (novos states `monthPendingPage` e `monthCompletedPage`)

### 3. Substituir a seção "Obrigações do mês" por Tabs
- Dentro do `<Card>`, após o header, renderizar `<Tabs defaultValue="pending">`
- Tab "A fazer" com contador (badge) e lista paginada de `monthEventsPending`
- Tab "Concluídas" com contador e lista paginada de `monthEventsCompleted`
- Reutilizar o mesmo card/evento JSX existente (extrair para bloco reutilizável)

### 4. States de paginação
- Substituir `monthPage` por `monthPendingPage` e `monthCompletedPage`
- Resetar ambos quando mês/filtros mudam

## Detalhes técnicos
- A função `isInstanceCompleted` já existe e faz exatamente a verificação necessária
- O componente `Tabs` do shadcn/ui já está disponível no projeto
- Nenhuma migração ou mudança de backend necessária

