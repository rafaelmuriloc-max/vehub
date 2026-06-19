## Causa raiz

Nova mensagem do SERPRO: `MSG_ISN_009 — Bloco 'Estabelecimento' não pode ser nulo.`

Para declaração **sem movimento**, o SERPRO exige que o bloco `estabelecimentos` exista com o CNPJ do contribuinte, mas com `atividades: []` (array vazio em vez de omitir).

## Correção

Em `src/components/integra-contador/PgdasdDeclaracaoForm.tsx`, no ramo `semMovimento` do `handleSubmit`:

Trocar:
```ts
estabelecimentos: [],
```

por:
```ts
estabelecimentos: [{ cnpjCompleto: cnpjContribuinte, atividades: [] }],
```

Nenhuma outra alteração necessária.
