

## Plano: Tornar usuário administrador

O usuário Rafael Murilo Celestino (ID: `a9a263c4-fafc-45dd-869f-622328fc56fc`) está com role `employee`. 

### Ação
Atualizar o registro na tabela `user_roles` para `admin` usando UPDATE direto no banco.

```sql
UPDATE user_roles SET role = 'admin' WHERE user_id = 'a9a263c4-fafc-45dd-869f-622328fc56fc';
```

Isso é uma operação de dados (não de schema), então será feita via insert tool. Após a alteração, o usuário terá acesso completo a todas as funcionalidades de administrador: gerenciar empresa, departamentos, sócios, usuários, clientes e financeiro.

