## Cronômetro ao lado do nome do atendente

Em `src/components/chat/ConversationList.tsx`, mover o `<WaitingBadge>` para dentro do mesmo container do badge do atendente (linha do `assignedToName` / "Não atribuído"), exibindo-o inline à direita.

- Trocar a `<div className="mt-1">` que envolve o badge do atendente por um `flex items-center gap-1.5` que comporte tanto o badge quanto o `WaitingBadge`.
- Remover o bloco separado `<div className="mt-1"><WaitingBadge .../></div>` abaixo.
- Manter as mesmas regras de visibilidade já implementadas (`activeTab==='in_progress'` com `waitingSince`/`lastMessageAt`, ou `awaitingFirstReply`).

Sem mudanças de backend nem de lógica.
