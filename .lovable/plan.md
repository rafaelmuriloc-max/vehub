# Corrigir busca por nome no encaminhar

O filtro atual em `ForwardMessageDialog.tsx` faz `phone.includes(search.replace(/\D/g,''))`, que vira `phone.includes('')` (sempre `true`) quando o termo é só letras — anulando o filtro por nome.

## Mudança

- `src/components/chat/ForwardMessageDialog.tsx`: aplicar match de telefone apenas se `searchDigits.length > 0`. O match por nome continua via `c.name.includes(q)`.
