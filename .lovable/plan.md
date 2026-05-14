## Mover o menu de ações (3 pontinhos) para dentro da bolha

Hoje o `DropdownMenu` com Editar/Apagar fica **fora** da bolha (irmão da `<div>` do balão). O usuário quer ele **dentro** da bolha, no canto superior direito.

## Alterações em `src/components/chat/MessageBubble.tsx`

1. Remover o bloco `{showOnRight && (onEdit || onDeleteForMe || onDeleteForAll) && (<DropdownMenu>…)}` que está fora do balão (linhas 215-243) e o equivalente do lado esquerdo (linhas 293-314).
2. Remover o wrapper `<div className="group relative flex items-start gap-1 …">` que existia só para acomodar o botão ao lado, deixando a `<div>` da bolha como filha direta.
3. Acrescentar o `group` na própria bolha (`<div className="relative group …">`).
4. Dentro da bolha, no topo, posicionar o botão dos 3 pontinhos absoluto no canto superior direito:
   ```tsx
   <DropdownMenu>
     <DropdownMenuTrigger asChild>
       <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-black/10">
         <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
       </button>
     </DropdownMenuTrigger>
     <DropdownMenuContent align="end" side="bottom">…itens condicionais…</DropdownMenuContent>
   </DropdownMenu>
   ```
5. Itens do menu — exibir conforme contexto (mesma lógica atual):
   - `Editar` se `canEdit && onEdit` (apenas em mensagens próprias).
   - `Apagar só para mim` se `onDeleteForMe`.
   - `Apagar para todos` se `canDeleteForAll && onDeleteForAll` (próprias ou admin).
6. Renderizar o menu **somente** quando houver pelo menos uma ação disponível.
7. Pequeno padding-right extra no `senderName` (ou no container do header da bolha) só quando o menu existir, para o nome não ficar atrás do ícone.

Não há mudanças em `MessageArea.tsx`, banco ou edge functions.