

# Melhorar UI/UX do cabeçalho do Calendário

## Problema atual
O cabeçalho tem um layout genérico: ícone + título em uma linha, filtros em um Card separado com label "Filtros" redundante. Os filtros ficam empilhados horizontalmente sem hierarquia visual clara, e o conjunto ocupa muito espaço vertical.

## Solução proposta
Unificar header e filtros em uma única seção coesa, com melhor hierarquia visual, aproveitando o design system existente (Navy/Orange) e aplicando princípios da skill de design:

### Layout redesenhado

```text
┌──────────────────────────────────────────────────────────────┐
│  📅 Calendário                                               │
│  Acompanhe prazos e obrigações dos seus clientes             │
│                                                              │
│  [Departamento ▾]  [🔍 Empresa ▾]  [Obrigação ▾]            │
│                                                              │
│  ● 3 filtros ativos                    [Limpar filtros]      │
└──────────────────────────────────────────────────────────────┘
```

### Detalhes das mudanças em `src/pages/CalendarView.tsx`

1. **Remover Card wrapper dos filtros** -- integrar filtros diretamente abaixo do título, dentro de um único bloco com fundo sutil (`bg-card rounded-xl border p-6`)

2. **Melhorar ícone do header** -- usar um container com gradiente sutil do primary ao invés de `bg-primary/10` flat

3. **Filtros inline com melhor espaçamento** -- usar `grid grid-cols-1 md:grid-cols-3 gap-4` para responsividade, removendo larguras fixas em favor de `w-full`

4. **Remover label "Filtros" redundante** -- o contexto já é claro pela posição

5. **Adicionar indicador de filtros ativos + botão limpar** -- mostrar quantos filtros estão ativos (diferentes de "all") com um badge, e um botão "Limpar filtros" que reseta todos para "all"

6. **Separador visual sutil** -- um `border-t` entre título e filtros para criar hierarquia

7. **Labels dos filtros mais integrados** -- mover labels para dentro dos triggers como placeholders contextuais, mantendo labels externos apenas quando há valor selecionado

## Arquivo
- `src/pages/CalendarView.tsx` (linhas ~411-503)

