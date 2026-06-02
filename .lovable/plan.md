## Remover aba WhatsApp das Configurações

### `src/pages/Settings.tsx`
- Remover o import de `EvolutionConnectionCard`.
- Remover `<TabsTrigger value="whatsapp">` e o `<TabsContent value="whatsapp">`.
- Ajustar `TabsList` de `grid-cols-6` para `grid-cols-5`.

### Preservado
- `EvolutionConnectionCard.tsx` e todas as edge functions `evolution-*` permanecem intactas — a conexão WhatsApp continua funcionando normalmente, só não aparece mais na UI de Configurações.
