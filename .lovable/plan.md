## Reposicionar contador de mensagens não lidas

Atualmente na lista de conversas (`src/components/chat/ConversationList.tsx`), o layout de cada item é:

```
[Avatar] [ Nome ............................. Horário ]
         [ Empresas (largura total) ........... ]
         [ ........................... Contador ]
         [ Badge atribuído / Espera ]
```

O usuário quer o contador **logo abaixo do horário** (canto direito), e a linha das empresas precisa **encolher** para não passar por baixo do contador.

### Mudança proposta

Reorganizar a coluna direita para empilhar horário + contador, e deixar a linha do nome da empresa limitada à largura disponível à esquerda:

```
[Avatar] [ Nome ............................ Horário  ]
         [ Empresas (encolhidas) .......... Contador ]
         [ Badge atribuído / Espera ]
```

### Detalhes técnicos

No bloco do `map filtered` (linhas ~228-247):

1. Trocar a primeira `div` interna `flex items-center justify-between` para uma estrutura que coloque **Nome + Empresa** numa coluna esquerda flexível, e **Horário + Contador** numa coluna direita empilhada (`flex flex-col items-end gap-1`).
2. A `<p>` do `companyNames` passa para dentro da coluna esquerda (logo abaixo do nome), com `truncate` e `min-w-0` para encolher corretamente.
3. O `<span>` do contador (linha 244) sai do bloco próprio e vai direto abaixo do horário na coluna direita; o wrapper `flex items-center justify-end mt-0.5` é removido.
4. Manter classes visuais já ajustadas: contador `bg-lime-600 ...`, empresas `text-cyan-950 font-medium ...`.
5. Manter o divisor inferior (`border-b border-border/60 pb-2.5 md:pb-3` no último wrapper) como está.

### Arquivos

- `src/components/chat/ConversationList.tsx` — apenas o bloco de renderização de cada item da lista.