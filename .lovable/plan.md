

## Plano: Alvarás com checkbox e data de vencimento

### Problema atual
O campo "Alvarás" é um Textarea de texto livre. O usuário precisa selecionar quais alvarás controlar e informar o vencimento de cada um.

### Solução

**Sem migration** — o campo `permits` (text) já existe. Armazenaremos os dados como JSON string.

### Alterações em `src/pages/Clients.tsx`

1. **Substituir o campo `permits`** (Textarea) por uma lista de 4 alvarás com checkbox + input de data:

   - Alvará de Funcionamento
   - Alvará Sanitário
   - Alvará dos Bombeiros
   - Registro de Classe

2. **Cada alvará** terá:
   - Um `Checkbox` para ativar/desativar o controle
   - Um `Input type="date"` para o vencimento (visível apenas quando marcado)

3. **Formato de armazenamento** no campo `permits` (JSON string):
   ```json
   [
     {"name":"Alvará de Funcionamento","enabled":true,"expiry":"2025-06-15"},
     {"name":"Alvará Sanitário","enabled":false,"expiry":""},
     {"name":"Alvará dos Bombeiros","enabled":true,"expiry":"2025-12-01"},
     {"name":"Registro de Classe","enabled":false,"expiry":""}
   ]
   ```

4. **Ao abrir para edição**, parsear o JSON de `permits` para popular os checkboxes e datas. Se o valor antigo for texto livre (legado), mostrar sem quebrar.

5. **No form state**, trocar `permits: string` por `permits: PermitItem[]` internamente, serializando para JSON string no `handleSave`.

### Detalhes Técnicos
- Sem migration necessária (campo `permits` text já existe e suporta JSON)
- Tipo `PermitItem = { name: string; enabled: boolean; expiry: string }`
- Constante com os 4 nomes de alvarás predefinidos
- Parsing seguro com try/catch ao carregar dados existentes

