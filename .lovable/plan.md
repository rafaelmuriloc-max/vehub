

# Plano: Separar categorias de serviços por abas

## Mudança

Substituir o dropdown "Categoria" por um componente `Tabs` horizontal com scroll, onde cada aba representa uma categoria do `SERVICE_CATALOG`. Ao clicar numa aba, os serviços daquela categoria aparecem diretamente no seletor de serviço abaixo.

## Implementação em `src/pages/IntegraContador.tsx`

1. **Importar** `Tabs, TabsList, TabsTrigger, TabsContent` de `@/components/ui/tabs`
2. **Remover** o `Select` de "Categoria" (linhas 337-351)
3. **Substituir** por um `<Tabs>` com:
   - `<TabsList>` com overflow horizontal (`flex-wrap` ou `overflow-x-auto`) contendo um `<TabsTrigger>` por categoria (ícone + label)
   - Cada `<TabsContent>` renderiza o seletor de serviço + campos de parâmetros da categoria selecionada
4. **Conectar** ao estado existente: `onValueChange` do `Tabs` chama `handleCategoryChange`, `value` usa `selectedCategory`
5. **Mover** o seletor de "Serviço", card de "Parâmetros" e botão "Enviar" para dentro de cada `TabsContent` (reutilizando o mesmo JSX, sem duplicar)

### Estrutura visual

```text
Card "Serviço"
┌──────────────────────────────────────────────┐
│ [SN] [MEI] [DCTFWeb] [Sicalc] [Caixa] ...  │  ← abas com scroll
├──────────────────────────────────────────────┤
│ Serviço: [dropdown dos serviços da aba]      │
│ Descrição do serviço selecionado             │
│                                              │
│ Parâmetros:                                  │
│ CNPJ Básico: [________]                     │
│ PA:          [________]                     │
│                                              │
│ [       Enviar Consulta        ]             │
└──────────────────────────────────────────────┘
```

### Arquivo

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/IntegraContador.tsx` — substituir Select de categoria por Tabs |

