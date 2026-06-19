Faltou enviar `deAcordoResolucao: true` no `EFETUAROPCAOREGIME101`.

## Mudança

Em `src/pages/IntegraContador.tsx`, no `handleSubmit`, dentro do bloco que já trata `descritivoRegime`, adicionar:

```ts
processedData.deAcordoResolucao = true;
```

Isso será incluído automaticamente sempre que o serviço enviar esse campo (apenas o EFETUAROPCAOREGIME101). Sem nova UI — é uma confirmação implícita exigida pelo SERPRO.