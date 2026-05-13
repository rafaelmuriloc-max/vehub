## Objetivo
Funcionários (role `employee`) não devem ver os menus **Dashboard** e **Financeiro**, e ao logar devem ir direto para `/calendar`. Admins continuam com acesso total e fluxo atual.

## Mudanças

### 1. `src/components/AppSidebar.tsx`
- Ler o role do usuário via `useAuth` (já expõe `profile`; verificar se há flag de admin — caso contrário, consultar `user_roles` ou usar helper existente).
- Filtrar `menuItems`: se não for admin, remover entradas `Dashboard` (`/`) e `Financeiro` (`/financial`).

### 2. Redirecionamento pós-login
- Em `src/pages/Auth.tsx`: após login bem-sucedido, se o usuário não for admin, navegar para `/calendar`; admin continua indo para `/`.
- Em `src/App.tsx` (rota `/`) ou `AppLayout`: se um funcionário acessar `/` ou `/financial` diretamente (URL), redirecionar para `/calendar` para evitar bypass via URL.

### 3. Proteção de rota (defesa em profundidade)
- Em `AppLayout` (ou wrapper), bloquear renderização de `Dashboard` e `Financial` para não-admins, redirecionando para `/calendar`.

## Detalhes técnicos
- Fonte da verdade do papel: `user_roles` via hook `useAuth` (verificar se já expõe `isAdmin`; se não, adicionar derivação simples consultando `has_role` ou a query atual de roles).
- Nenhuma mudança de banco/RLS — somente UI e roteamento.
- Sem alteração nos demais menus.

## Fora de escopo
- Permissões de outros menus (mantém comportamento atual).
- Mudanças em RLS de `financial`/dashboards.
