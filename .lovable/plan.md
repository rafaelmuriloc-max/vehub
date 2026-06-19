O SERPRO exige também o campo `descritivoRegime` ("COMPETENCIA" ou "CAIXA") junto com `tipoRegime` e `anoOpcao`.

## Mudança

Em `src/pages/IntegraContador.tsx`:

1. Em vez de pedir `tipoRegime` ao usuário, simplificar para um único campo "Regime de Apuração" com duas opções textuais (COMPETENCIA / CAIXA).
2. No `handleSubmit`, quando o serviço for `REGIMEAPURACAO/EFETUAROPCAOREGIME101`, derivar:
   - `descritivoRegime` = valor selecionado ("COMPETENCIA" ou "CAIXA")
   - `tipoRegime` = 0 para COMPETENCIA, 1 para CAIXA
   - manter `anoOpcao`
3. Atualizar o campo `F_TIPO_REGIME` para `F_REGIME` com `key: 'descritivoRegime'` e options `[{value:'COMPETENCIA'},{value:'CAIXA'}]`.

Nenhuma outra alteração.