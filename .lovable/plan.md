# Redesign da tela de Obrigações (Calendário)

Direção escolhida: **Grade densa com trilha de risco**, mantendo Navy/Laranja da Velocitä, tipografia Sora (títulos) + Manrope (corpo) e estrutura de dashboard.

## O que muda

**Cabeçalho do mês**
- Título "Obrigações de Agosto 2026" com subtítulo compacto (total / a fazer / atrasadas).
- Abas de status (A fazer, Concluídas, Fora do prazo, Aguardando, Excluídas, Suspensos) em barra rolável horizontal, com contadores em pílula; "Fora do prazo" em vermelho e "Aguardando" em âmbar.

**Barra de filtros**
- Linha única e compacta: selecionar todos + filtros existentes (cliente, departamento, tipo) + contador "Exibindo X de Y obrigações" à direita.
- Barra de seleção em massa aparece no mesmo lugar, sem empurrar a lista.

**Lista (o coração da mudança)**
- Cabeçalho de colunas fixo: Vencimento | Obrigação / Empresa | Departamento | Progresso | Ações.
- Linhas com cerca de metade da altura atual (uma linha para obrigação + competência + tag, outra para a empresa `262 - NOME`), aumentando de ~6 para ~12 itens visíveis por tela.
- **Trilha de risco**: barra colorida de 4px na borda esquerda — vermelho (atrasado), âmbar (vence hoje), azul (próximos dias), cinza (sem urgência), verde (concluído), âmbar claro (aguardando).
- Coluna de data com o dia em destaque e um rótulo curto abaixo: ATRASADO, HOJE, AMANHÃ, "6 dias".
- Progresso vira texto compacto "0/1 atividades" com micro-barra; some quando não há atividades.
- Ações (Concluir, Aguardar, Excluir, Sem Movimento quando aplicável) alinhadas à direita, discretas e reveladas no hover, com tooltip.
- Aba Aguardando mostra o motivo em linha secundária, com autor e data.

**Estados e detalhes**
- Linha selecionada com realce e borda; hover suave; números com fonte tabular.
- Estado vazio por aba com ícone e texto curto.
- Paginação enxuta no rodapé da lista.

## Escopo técnico

- Alterações apenas de apresentação em `src/pages/CalendarView.tsx` (lista mensal, lista do dia, abas, barra de filtros e barra de seleção em massa). Nenhuma consulta, mutação ou regra de negócio muda.
- Cores via tokens semânticos existentes em `src/index.css` / `tailwind.config.ts`; se faltar token para os estados de risco (atrasado / hoje / aguardando), adiciono-os como tokens HSL em vez de classes fixas.
- Fontes Sora + Manrope registradas no `index.html` e mapeadas em `tailwind.config.ts` (`font-display` para títulos, `font-sans` para corpo).
- Responsivo: no mobile as colunas Departamento e Progresso colapsam para a segunda linha; as ações viram um menu compacto.
- Sem mudanças em banco de dados, edge functions ou rotas.

## Fora do escopo

- Grade mensal do calendário (visão de dias), páginas de Documentos e Tarefas.
- Novos filtros, novas abas ou novas ações além das existentes.
