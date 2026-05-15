## Ajuste

Em `src/components/tasks/TaskEditDialog.tsx`, aumentar a largura do `DialogContent` para acomodar todo o conteúdo (campos, badges de atribuição, anexos com nomes longos).

**Mudança única**

De:
```
w-[calc(100vw-1rem)] sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6
```

Para:
```
w-[calc(100vw-1rem)] sm:max-w-2xl lg:max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6
```

Isso mantém o comportamento responsivo (full-width em mobile) e dá mais espaço em telas médias/grandes para nomes de arquivos, badges e selects sem truncamento.
