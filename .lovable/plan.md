# Encaminhar para qualquer conversa

Remover o filtro `status = 'open'` em `ForwardMessageDialog.tsx` para que a busca traga todas as conversas (abertas e fechadas), mantendo a ordenação por `updated_at` desc e o limite de 200.

## Arquivo

- `src/components/chat/ForwardMessageDialog.tsx` — remover `.eq('status', 'open')` na query de carregamento das conversas.
