# Menu Impostos no portal do cliente

## O que muda
- Novo item **Impostos** no menu de baixo (celular) e nas abas (computador), entre Calendário e Documentos.
- Dentro dele, uma aba para cada tipo de imposto que a empresa tem: DAS, ISS, ICMS, PIS/COFINS, IRPJ/CSLL, INSS e FGTS. Só aparecem as abas com guias. No celular, as abas deslizam para o lado.
- Cada aba lista as guias dos últimos 12 meses e dos próximos vencimentos, da mais recente para a mais antiga, com:
  - competência (mês anterior ao vencimento) e data de vencimento;
  - valor, quando houver (hoje só o DAS do Simples traz valor);
  - situação: **Guia disponível**, **Em preparação** (o escritório ainda não concluiu) ou **Vencida** (quando já passou e a guia não foi entregue);
  - botões **Visualizar** e **Baixar** quando o escritório anexou a guia.
- Seletor de ano no topo para ver anos anteriores.
- O DAS gerado pelo próprio portal (MEI) continua em Documentos, como hoje.

## Detalhes técnicos
- `src/pages/Portal.tsx`: nova view `impostos` no NAV (6 itens, `grid-cols-6`); componente `ImpostosView({clientId})` que chama `portal_due_dates` para o ano escolhido (01/01 a 31/12, ou até +4 meses no ano atual), filtra com `isTaxDue`, agrupa por `tagFor`, e reutiliza `openDoc` (URL assinada) e `competenciaFromDue`.
- Junta as guias do Simples (`simples_nacional_competencias`, já carregadas) na aba DAS com o valor.
- Helper `groupByTax(items)` em `src/lib/portalDashboard.ts` com testes (ordem das abas, agrupamento PIS/COFINS e IRPJ/CSLL, abas vazias omitidas).
- Nenhuma mudança no banco: a função atual já devolve arquivo e situação.
