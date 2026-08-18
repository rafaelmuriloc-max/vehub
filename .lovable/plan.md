# Melhorar o layout das abas de obrigações

Refinar apenas a aparência das abas na página do Calendário (visão mensal com 6 abas e visão do dia com 2 abas). Nenhuma mudança de regra de negócio ou de dados.

## Direção escolhida: abas sublinhadas estilo relatório

- Sem fundo de "pílula": apenas texto, com a aba ativa marcada por uma linha laranja (cor primária) embaixo e texto em destaque.
- Abas inativas em texto muted, com hover leve e transição suave da cor/sublinhado.
- Contador ao lado do rótulo em tamanho pequeno e discreto; some quando for zero, para reduzir ruído.
- Linha divisória fina abaixo de toda a barra de abas, ligando visualmente com a lista abaixo.
- No mobile a barra vira uma faixa horizontal rolável (sem barra de rolagem visível), em vez de quebrar em várias linhas como hoje.
- Espaçamento e altura de toque confortáveis; mesmo tratamento aplicado às abas do dia (A Fazer / Concluído).

## Detalhes técnicos

Arquivo: `src/pages/CalendarView.tsx`.

- Criar um componente local `ObligationTab` (mesmo arquivo) recebendo `value`, `label` e `count`, renderizando um `TabsTrigger` já estilizado; substituir os 8 `TabsTrigger` atuais por ele.
- `TabsList` mensal: trocar `flex-wrap h-auto gap-1` por `w-full justify-start gap-4 bg-transparent p-0 h-auto border-b rounded-none overflow-x-auto` com utilitário para esconder a scrollbar.
- `TabsList` do dia: mesma base, mantendo distribuição em duas colunas.
- Estilo ativo via `data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none`, inativo `text-muted-foreground hover:text-foreground`.
- Usar apenas tokens do design system (`border-primary`, `text-muted-foreground`, `text-foreground`), sem cores fixas.
