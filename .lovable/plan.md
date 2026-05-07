## Problem

SERPRO rejeitou o termo de autorização com a mensagem:

> `[EntradaIncorreta-AUTENTICAPROCURADOR-018]` Layout do XML inválido: data de assinatura não deve ser posterior a data atual.

No XML enviado, `dataAssinatura="20260507"`, mas o `responseDateTime` do SERPRO é `2026-05-06T22:38:42Z` — ou seja, no horário de Brasília (UTC-3) ainda era **06/05/2026**. O SERPRO valida a data contra o fuso de Brasília e rejeita qualquer data futura.

## Causa

Em `supabase/functions/integra-contador/index.ts` (linhas 49–52), `dataAssinatura` é calculada com `new Date()` + `getFullYear/getMonth/getDate`. No runtime do Deno (Supabase Edge), `Date` opera em **UTC**, então quando o relógio UTC já virou para o dia seguinte (após 21h Brasília no horário padrão / 00h UTC), o XML é gerado com a data de "amanhã" segundo Brasília, e o SERPRO rejeita.

## Fix

Calcular `dataAssinatura` (e `vigencia`) usando o fuso `America/Sao_Paulo` via `Intl.DateTimeFormat`, garantindo que a data assinada nunca seja posterior ao "hoje" de Brasília.

```ts
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit',
});
const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
const dataAssinatura = `${parts.year}${parts.month}${parts.day}`;
const vigencia = `${parts.year}1231`;
const termoId = `TERMO-${dataAssinatura}${...horários BRT...}`;
```

Também aplicar o mesmo cálculo (BRT) ao `termoId` para consistência.

## Arquivos alterados

- `supabase/functions/integra-contador/index.ts` — função `generateSerproProcuradorXML` (linhas ~49–54).

## Validação

- Reexecutar a consulta PGDAS-D para o cliente ALECSANDRO THIAGO ACADEMIA. O SERPRO deve aceitar o termo (status 200) e retornar os dados.
- Logs do edge function devem mostrar `dataAssinatura` igual à data atual de Brasília.
