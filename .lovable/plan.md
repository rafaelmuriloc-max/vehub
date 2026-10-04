# Perfil no cabeçalho do portal

## O que muda
- Sai o item **Perfil** do menu de baixo (celular) e das abas (computador). O menu fica com 5 itens, com mais espaço para cada um: Dashboard, Calendário, Documentos, Notas, Pessoal.
- As iniciais no topo passam a ser o acesso ao perfil. O menu delas ganha a opção **Meu perfil**, que abre a tela de perfil atual, além de Trocar senha e Sair.

## Detalhes técnicos
- `src/pages/Portal.tsx`: remover `perfil` do array NAV (a view continua existindo); `grid-cols-6` → `grid-cols-5`; adicionar `DropdownMenuItem` "Meu perfil" (ícone User) com `setView('perfil')`.
