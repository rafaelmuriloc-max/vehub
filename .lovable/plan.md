# Melhorar o layout das abas de obrigações

Refinar apenas a aparência das abas na página do Calendário (visão mensal com 6 abas e visão do dia com 2 abas). Nenhuma mudança de regra de negócio ou de dados.

## O que muda

- **Barra de abas em linha única e rolável no mobile**: hoje as 6 abas do mês quebram em várias linhas. Passam a ficar numa faixa horizontal com rolagem suave (sem barra visível), mantendo todas visíveis no desktop.
- **Ícone por aba** para leitura rápida: A fazer (relógio), Concluídas (check), Fora do prazo (alerta), Aguardando (pause), Excluídas (lixeira), Suspensos (ban).
- **Contadores coloridos por contexto**: pendente em âmbar, concluídas em verde, fora do prazo/excluídas em vermelho, aguardando em âmbar, suspensos em cinza — usando tokens do design system (nada hardcoded).
- **Aba ativa destacada** com fundo em card, sombra sutil e texto em destaque; abas inativas com texto muted e hover leve.
- **Contador some quando é zero** para reduzir ruído visual.
- **Abas do dia** (A Fazer / Concluído) recebem o mesmo tratamento visual, mantendo o grid de 2 colunas.
- Alvos de toque maiores (altura mínima confortável) e espaçamento consistente com o restante da página.

## Detalhes técnicos

Arquivo: `src/pages/CalendarView.tsx`.

- Criar um pequeno componente local `ObligationTab` (dentro do arquivo) que recebe `value`, `label`, `icon`, `count` e `tone`, renderizando um `TabsTrigger` já estilizado; substituir os 8 `TabsTrigger` atuais por ele.
- `TabsList` mensal: trocar `flex-wrap h-auto gap-1` por faixa `overflow-x-auto` com `scrollbar-none`, `w-full justify-start`, `gap-1`, `p-1`.
- Estilos via `data-[state=active]` e classes utilitárias com tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary/10`, `bg-destructive/10`, etc.), sem cores fixas.
- Ícones já disponíveis no `lucide-react` importado no arquivo; adicionar apenas os que faltarem.
