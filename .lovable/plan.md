

## Plano: Reorganizar menu Cadastro com submenus

### Mudanças

**1. Sidebar (`src/components/AppSidebar.tsx`)**
- Transformar o item "Cadastro" em um menu colapsável usando `Collapsible` + `SidebarMenuSub`/`SidebarMenuSubItem`/`SidebarMenuSubButton`
- Submenus:
  - **Meu Escritório** → `/settings` (página Settings atual)
  - **Obrigações** → `/obligations` (página Obligations atual)
  - **Tipos de Documento** → `/settings/document-types` (nova rota)
- Remover "Obrigações" do menu principal (já existente lá)
- Importar `ChevronRight` e os componentes de submenu do sidebar

**2. Rotas (`src/App.tsx`)**
- Adicionar rota `/settings/document-types` apontando para uma nova página dedicada
- Manter `/settings` e `/obligations` como estão

**3. Nova página `src/pages/DocumentTypes.tsx`**
- Página simples que renderiza apenas o componente `DocumentTypesTab` já existente, com título "Tipos de Documento"

**4. Settings (`src/pages/Settings.tsx`)**
- Remover a aba "Tipos de Documento" do TabsList (pois agora tem rota própria)
- Renomear título para "Meu Escritório"

**5. Obligations (`src/pages/Obligations.tsx`)**
- Sem mudanças no conteúdo, apenas reorganização de onde é acessado

### Estrutura do menu resultante

```text
Menu
  Dashboard
  Clientes
  Financeiro
  Documentos
  Tarefas
  Calendário

Administração
  Cadastro (colapsável)
    ├─ Meu Escritório
    ├─ Obrigações
    └─ Tipos de Documento
```

