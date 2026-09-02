# Colunas Fechamento e Duração na lista de chamados

Adicionar duas colunas na tabela de `/tickets`:

1. **Fechamento** — logo após a coluna **Abertura**, exibindo `closed_at` formatado com `fmtDate`.
2. **Duração** — logo após **Fechamento**, exibindo `handle_seconds` formatado com `fmtDuration` (diferença entre abertura e fechamento já calculada pelo backend).

## Arquivo alterado

- `src/pages/Tickets.tsx`
  - Incluir `<th>` e `<td>` para as novas colunas no cabeçalho e nas linhas da tabela.
  - Ajustar `colSpan` da mensagem "Nenhum chamado encontrado" de 7 para 9.
  - Manter responsividade: colunas secundárias continuam ocultas em breakpoints menores quando aplicável.

Não são necessárias alterações de backend, pois `support_tickets` já retorna `closed_at` e `handle_seconds`.
