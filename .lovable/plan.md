

# Remover rodapé/espaço extra no chat

## Problema
O container do chat usa `h-[calc(100dvh-3rem)]` no mobile, subtraindo 3rem para compensar um header. Porém, o header do AppLayout já é ocultado na rota `/chat`, então essa subtração cria um espaço vazio (rodapé) de 3rem na parte inferior.

## Solução

### `src/pages/Chat.tsx` (linha 463)
Alterar a altura do container de:
```
h-[calc(100dvh-3rem)]
```
para:
```
h-[100dvh]
```

Isso faz o chat ocupar 100% da viewport no mobile, sem espaço sobrando embaixo.

## Arquivo alterado
- `src/pages/Chat.tsx` — 1 classe CSS ajustada

