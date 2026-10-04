# Calendário Fiscal do portal só com vencimento de impostos

## O que muda para o cliente
- O Calendário Fiscal e a lista "Vencimentos Próximos" (e o cartão "Próximos vencimentos") passam a mostrar só guias de imposto:
  - DAS - Simples Nacional, ISS, ICMS, PIS/COFINS, IRPJ/CSLL, Darf Previdenciário (INSS) e FGTS.
- Deixam de aparecer as obrigações que não são pagamento de imposto: Folha de Pagamento Mensal, Folha Pró Labore, Adiantamento Salarial, DEFIS, MIT e REINF.
- ICMS ganha etiqueta própria; a etiqueta "Folha" sai da legenda.
- Obrigações novas cadastradas depois só aparecem se o nome indicar um imposto (DAS, ISS, ICMS, PIS, COFINS, IRPJ, CSLL, INSS/Darf, FGTS, IRRF).

## Detalhes técnicos
- `src/lib/portalDashboard.ts`: função `isTaxDue(name)` (exclui FOLHA, SALARIO, PRO LABORE, DEFIS, MIT, REINF, DCTF, ESOCIAL, DECLARA; aceita apenas nomes cujo `tagFor` não seja `folha`/`outro`); nova tag `icms` com token de cor; remover `folha` de `TAGS` (legenda).
- `src/pages/Portal.tsx`: filtrar os vencimentos com `isTaxDue` antes de montar calendário, próximos vencimentos e cartão.
- Testes em `src/lib/portalDashboard.test.ts` para os 13 nomes atuais (7 entram, 6 saem).
