## Objetivo

Mostrar, na lista de conversas, as empresas vinculadas ao contato logo abaixo do nome — igual ao que já aparece no header do chat aberto.

## Contexto

- `ConversationItem` já carrega `companyNames?: string[]` (populado em `Chat.tsx` via `whatsappCompanyMap`).
- Hoje esse dado só é exibido no `MessageArea` (header do chat).
- Na lista (`ConversationList.tsx`), nada é renderizado abaixo do nome.

## Mudança

Editar apenas `src/components/chat/ConversationList.tsx`:

1. Logo abaixo da linha do nome + horário, antes da linha de "última mensagem", inserir uma linha discreta com as empresas vinculadas quando `conv.companyNames?.length > 0`.
2. Estilo: texto pequeno (`text-[11px]`), cor `text-muted-foreground`, `truncate` em uma linha, empresas separadas por `•` (ou `|` para manter padrão do header).
3. Não exibir nada quando a lista estiver vazia (contatos sem vínculo continuam como hoje).

Sem mudanças em backend, tipos ou em `Chat.tsx` — os dados já chegam prontos.

## Resultado visual esperado

```text
[avatar]  Rafael Murilo                           21:44
          RJ Climatização • Outra Empresa
          RJ CLIMATIZAÇÃO FGTS 042026.pdf
          [badge status]
```
