# Mover Documentos e Tarefas para dentro do Calendário

## Objetivo
Consolidar as páginas Documentos e Tarefas em sub-views do Calendário, acessíveis por dois botões no canto superior direito da página.

## Mudanças

### 1. `src/pages/CalendarView.tsx`
- Adicionar estado local `view: 'calendar' | 'documents' | 'tasks'` (default `calendar`).
- No header da página (topo, ao lado direito do título), adicionar dois `Button` com ícones (`FileText` "Documentos" e `CheckSquare` "Tarefas"). Quando ativos, alternam para a respectiva view; quando inativos, voltam ao calendário.
- Renderizar condicionalmente:
  - `calendar` → conteúdo atual (Tabs do calendário / cronograma / lista).
  - `documents` → `<DocumentsView />` (componente extraído).
  - `tasks` → `<TasksView />` (componente extraído).

### 2. Extrair conteúdo de páginas em componentes
- `src/pages/Documents.tsx` → renomear export padrão para um componente reutilizável `DocumentsView` (mantendo arquivo) **ou** simplesmente importar o `Documents` atual como componente dentro do CalendarView. Optaremos por importar diretamente os componentes existentes (`Documents`, `Tasks`) e renderizá-los sem o wrapper de página — eles já são auto-contidos.
- Não modificar a lógica interna de Documentos/Tarefas.

### 3. `src/App.tsx`
- Remover as rotas `/documents` e `/tasks` (passam a viver dentro de `/calendar`).
- Manter imports apenas se ainda usados em outros lugares; caso contrário, remover.

### 4. `src/components/AppSidebar.tsx`
- Remover os itens "Documentos" e "Tarefas" do menu lateral.

### 5. `src/components/AppLayout.tsx`
- Remover `/documents` e `/tasks` do mapa `pageTitles`.

## Observações
- Nenhuma alteração de backend, schema ou edge functions.
- Botões no topo direito usam estilo `variant="outline"` quando inativos e `variant="default"` quando ativos, com ícone + label (label oculto em mobile via `hidden sm:inline`).
- Links externos para `/documents` ou `/tasks` deixarão de funcionar; ao remover rotas, qualquer acesso direto cairá no NotFound. Se houver links internos relevantes, redirecionar para `/calendar`.
