

# CRUD Completo de Clientes

## Situação atual

O módulo de clientes já possui **Create**, **Read** (listagem) e **Update**. Faltam:

1. **Delete** - Não existe opção de excluir cliente
2. **Visualização** - Não-admins não conseguem ver detalhes de um cliente (só a tabela)
3. **Confirmação de exclusão** - Sem dialog de confirmação antes de deletar

## Alterações planejadas

### 1. Botão de exclusão com confirmação (admin only)
- Adicionar botão "Excluir" na coluna de ações da tabela (ícone Trash2, vermelho)
- AlertDialog de confirmação antes de excluir
- Ao confirmar: deletar registros relacionados (`client_department_contacts`) e depois o cliente
- Também remover certificado do Storage se existir
- Toast de sucesso/erro

### 2. Botão de visualização para todos os usuários
- Adicionar botão "Ver" (ícone Eye) na coluna de ações, visível para todos
- Abre o mesmo dialog em modo read-only (campos desabilitados, sem botão Salvar)
- Admins mantêm o botão "Editar" separado

### 3. Melhorias na tabela
- Adicionar paginação na listagem (10 por página)
- Tornar a tabela responsiva com cards em mobile

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/pages/Clients.tsx` | Adicionar função `handleDelete` com AlertDialog de confirmação, botão "Ver" para modo read-only, paginação simples na listagem, e layout responsivo com cards em mobile |

## Detalhes técnicos

- `handleDelete(clientId)`: deleta `client_department_contacts` where `client_id`, remove certificado do Storage, deleta de `clients`, recarrega lista
- Estado `viewOnly: boolean` para controlar se o dialog é read-only
- Paginação com estado `page` e `pageSize = 10`, calculando `filtered.slice(start, end)`
- Mobile: `hidden md:table-cell` nas colunas menos importantes, cards abaixo de `md:`

