# Bloco de data em Vencimentos Próximos igual ao modelo

O quadrado com a data de cada vencimento fica como no modelo:

- **Dia:** número grande, em negrito forte (por exemplo, "05").
- **Mês:** sigla em maiúsculas logo abaixo, menor e mais fina (por exemplo, "NOV").
- **Formato:** caixa um pouco maior e mais arredondada, com fundo azul bem claro e borda suave azul. O texto fica em azul-marinho.
- **Vencimentos urgentes:** quando o selo está vermelho (até 3 dias ou já vencido), a caixa fica com fundo rosado, borda vermelha suave e número vermelho. A sigla do mês continua escura.

## Technical details
- Só `UpcomingDues` em `src/components/portal/PortalWidgets.tsx`.
- Caixa: `h-14 w-14 rounded-xl border`.
  - Normal: `bg-portal-blue-soft border-portal-blue/15`, dia em `text-portal-ink`.
  - Urgente (`b.tone === 'danger'`): `bg-destructive/10 border-destructive/20`, dia em `text-destructive`.
- Dia: `text-xl font-extrabold leading-none`. Mês: `text-[11px] font-medium uppercase text-portal-ink mt-0.5`.
