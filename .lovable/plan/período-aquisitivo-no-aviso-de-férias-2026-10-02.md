# Período aquisitivo no aviso de férias

## O que muda
No aviso de vencimento de férias enviado por WhatsApp, cada colaborador passa a mostrar também o período aquisitivo, logo acima do prazo limite:

```text
👤 *MARIA CARLA ALVES CARDOSO*
• Período aquisitivo: 05/08/2025 a 04/08/2026
• Limite: *06/07/2027* (em 270 dia(s))
• Saldo: 27,5 dias
```

Se o relatório não trouxer a data final do período, aparece só a data de início ("a partir de 05/08/2025").

O aviso de contratos de experiência não muda.

## Detalhes técnicos
- `src/components/personnel/PersonnelAlertsDialog.tsx`: incluir `acquisition_start` no select de `employee_vacation_periods` e acrescentar a linha "• Período aquisitivo: …" no `line` de cada período, formatada com `br()`.
- Sem mudança no banco.
