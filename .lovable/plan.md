## Objetivo
Aplicar a tipografia Inter já configurada no projeto com os refinamentos profissionais sugeridos (peso, tracking, espaçamento, números tabulares), no estilo Linear/Stripe.

## Diagnóstico
A fonte Inter já está importada (`src/index.css` linha 1) e configurada em `tailwind.config.ts` (`fontFamily.sans`). Faltam apenas os refinamentos de uso: line-height respirado, tracking negativo em títulos, números tabulares (`tnum`) para KPIs/tabelas e ativação de ligaduras Inter (`cv11`, `ss01`).

## Mudanças

### Arquivo: `src/index.css`
1. **Bloco `@layer base` global** — aplicar no `html, body`:
   - `font-family: var(--font-sans);`
   - `font-feature-settings: 'cv11', 'ss01', 'tnum';` (números alinhados em todo o sistema)
   - `-webkit-font-smoothing: antialiased;`
   - `text-rendering: optimizeLegibility;`
   - `line-height: 1.5;`
2. **Títulos `h1, h2, h3, h4`** — `letter-spacing: -0.02em;` e `line-height: 1.2;` (tracking levemente negativo).
3. **Classe utilitária `.tabular-nums-strong`** para KPIs/cards numéricos: `font-feature-settings: 'tnum', 'cv11'; font-variant-numeric: tabular-nums;`
4. **Ajuste do `--radius`** de `0.75rem` (12px) para `1.25rem` (20px), conforme a recomendação visual (cards mais "air").
5. **Sutil suavização do background** — manter `--background: 220 20% 97%` (já é off-white próximo a #F8FAFC).

### Arquivo: `tailwind.config.ts`
- Adicionar escala de tamanho coerente em `theme.extend.fontSize`:
   - `kpi: ['48px', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '700' }]`
   - `section: ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }]`
   - `menu: ['16px', { lineHeight: '1.4', fontWeight: '500' }]`
   - `body: ['15px', { lineHeight: '1.5' }]`
   - `label: ['13px', { lineHeight: '1.4', fontWeight: '500' }]`

### Onde aplicar
- KPIs principais (cards de resumo do `/calendar`, dashboard, financeiro): adicionar `tabular-nums` no número.
- Títulos de página (`text-2xl`/`text-3xl` em `Clients.tsx`, `CalendarView.tsx`, `Dashboard`, etc.): herdam o tracking negativo automaticamente via `h1/h2`.
- Menus do sidebar (`AppSidebar.tsx`): herdam o `font-medium` global via classes existentes.

## Fora do escopo
- Sem troca de paleta de cores.
- Sem alteração de componentes ou lógica.
- Sem importação de novas fontes (Plus Jakarta / Manrope não serão adicionadas — o usuário concluiu que Inter é a melhor escolha).