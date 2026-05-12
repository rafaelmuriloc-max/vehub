## Reorganização das abas do Chat

Atualmente as 3 abas são: **Chat** (meus abertos), **Atendidos** (meus fechados) e **Todos**.

Vou reconfigurá-las conforme solicitado:

### 1. Aba "Chat" (`mine`)

- Mantém: conversas com `status = 'open'` e `assigned_to = usuário logado`.
- Sem alteração de lógica.

### 2. Aba "Em andamento" (`in_progress`) — substitui "Atendidos"

- Filtro: `status = 'open'` **e** `assigned_to <> usuário logado` (incluindo `assigned_to IS NULL`, que são chamados abertos ainda não atribuídos a ninguém).
- Renomear o valor do tipo `ChatTab` de `'closed'` para `'in_progress'`.
- Mostrar os chamados abertos atribuídos aos outros usuários 
- Atualizar label da aba para **"Em andamento"**.

### 3. Aba "Geral" (`all`)

- Mantém: sem filtro (todo histórico — abertos e fechados).
- Renomear label de "Todos" para **"Geral"**.

### Arquivos afetados

`**src/pages/Chat.tsx**`

- Trocar o tipo `ChatTab` para `'mine' | 'in_progress' | 'all'`.
- Em `loadConversations`, substituir o branch `closed` por:
  ```ts
  } else if (currentTab === 'in_progress') {
    query = query
      .eq('status', 'open')
      .or(`assigned_to.neq.${user.id},assigned_to.is.null`);
  }
  ```

`**src/components/chat/ConversationList.tsx**`

- Atualizar o `TabsTrigger` com `value="closed"` → `value="in_progress"` e label "Em andamento".
- Renomear o label da aba `all` de "Todos" para "Geral".

### Fora de escopo

- Lógica de transferência, fechamento e reabertura de chamados (mantidas como estão).
- Permissões/RLS (não há mudança de acesso, apenas filtragem do lado cliente).