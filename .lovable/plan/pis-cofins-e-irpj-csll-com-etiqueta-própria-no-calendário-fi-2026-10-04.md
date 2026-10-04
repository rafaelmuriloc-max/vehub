# PIS/COFINS e IRPJ/CSLL com etiqueta própria no Calendário Fiscal do portal

## O que muda para o cliente
- No Calendário Fiscal, vencimentos de PIS e COFINS aparecem com a etiqueta **PIS/COFINS**.
- Vencimentos de IRPJ e CSLL aparecem com a etiqueta **IRPJ/CSLL**.
- **DARF** fica só para os demais (por exemplo IRRF ou guias chamadas DARF).
- Cada nova etiqueta ganha cor própria e entra na legenda abaixo do calendário.

## Detalhes técnicos
- `src/lib/portalDashboard.ts`: novas chaves `pis_cofins` e `irpj_csll` em `TagKey`/`TAGS`; `tagFor` testa PIS|COFINS e IRPJ|CSLL antes da regra DARF.
- `src/components/portal/PortalWidgets.tsx`: `TAG_BG` com as novas cores; tokens `--tag-pis-cofins` e `--tag-irpj-csll` em `src/index.css` e `tailwind.config.ts`.
- `src/lib/portalDashboard.test.ts`: testes para "PIS", "COFINS", "IRPJ", "CSLL" e "IRRF" (continua DARF).
