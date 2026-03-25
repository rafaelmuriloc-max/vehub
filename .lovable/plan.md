

# Destacar Dia Atual com Fundo Azul

## Objetivo
Alterar o destaque do dia atual no calendário de fundo cinza/accent para fundo azul.

## Mudança

### Arquivo: `src/pages/CalendarView.tsx`

Na renderização das células do calendário, onde o dia atual (`isToday`) recebe classes de destaque, trocar o fundo atual (provavelmente `bg-accent` ou `bg-primary/10`) por `bg-blue-500 text-white` (ou `bg-blue-100` se preferir sutil). Ajustar também o número do dia que já tem destaque circular para usar azul.

Preciso verificar o código atual para identificar as classes exatas.

