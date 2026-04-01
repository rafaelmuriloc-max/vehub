

# Desatribuir chamados ao fechar

## Problema
Quando um chamado é fechado, o campo `assigned_to` permanece com o usuário anterior. Chamados fechados devem ser desatribuídos automaticamente.

## Alteração em `src/pages/Chat.tsx`

Na função `closeTicket` (linha ~369), adicionar `assigned_to: null` ao update:

```typescript
.update({ status: 'closed', closed_at: new Date().toISOString(), assigned_to: null } as any)
```

Isso garante que ao fechar o chamado, ele não aparece mais como atribuído a nenhum usuário. Ao reabrir, o chamado ficará sem responsável até ser atribuído novamente.

## Arquivo
- `src/pages/Chat.tsx` (1 linha alterada)

