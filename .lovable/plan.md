

# Remover limite de 200 notas na carga de dados

## Problema
O `loadInvoices()` em ambos os componentes usa `.limit(200)`, impedindo que notas além das 200 mais recentes sejam exibidas. Com a paginação client-side já implementada, esse limite é desnecessariamente restritivo.

## Opções

### Opção A — Remover o limite (simples)
- Remover `.limit(200)` de ambos os componentes
- Funciona bem para até ~2.000-3.000 notas
- Pode ficar lento se o cliente tiver dezenas de milhares

### Opção B — Aumentar para 1000 (compromisso)
- Trocar `.limit(200)` por `.limit(1000)`
- Cobre a maioria dos casos sem risco de performance

### Opção C — Paginação server-side (ideal para escala)
- Carregar apenas a página atual do Supabase usando `.range(from, to)`
- Requer refatorar o filtro para ser feito via query SQL, não client-side
- Mais complexo, mas escala para qualquer volume

## Recomendação
**Opção A** — remover o limite. Para um escritório contábil, o volume típico por consulta (filtrado por mês/cliente) raramente ultrapassa alguns milhares. Se no futuro o volume crescer, migra-se para paginação server-side.

## Alterações
- `src/components/invoices/NfseTab.tsx` — remover `.limit(200)` (linha 111)
- `src/components/invoices/NfeTab.tsx` — remover `.limit(200)` (linha 103)

