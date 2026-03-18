

# Redesign UI/UX - Identidade Visual Velocitä Contabilidade

## Analise da Marca

Com base no site velocitacontabilidade.com.br, a identidade visual da Velocitä usa:
- **Azul marinho escuro** (navbar, textos) como cor principal
- **Laranja/amber** como cor de destaque (barras do logo, botões CTA)
- **Branco limpo** como fundo
- **Tipografia moderna** sem serifa
- Estilo corporativo, limpo e profissional

## Paleta de Cores (HSL)

```text
                Atual                    Novo (Velocitä)
Primary:        200 98% 39% (azul)   →  220 50% 15% (azul marinho escuro)
Accent/Ring:    (mesmo)              →  28 90% 52% (laranja Velocitä)
Background:     209 40% 96%          →  220 20% 97% (branco levemente azulado)
Card:           210 40% 98%          →  0 0% 100% (branco puro)
Sidebar bg:     0 0% 98%             →  220 50% 12% (marinho escuro)
Sidebar fg:     222 47% 11%          →  0 0% 95% (branco)
Sidebar accent: 215 24% 26%          →  28 90% 52% (laranja)
```

## Mudancas Planejadas

### 1. Cores e Design Tokens (`src/index.css`)
- Atualizar toda a paleta light para refletir azul marinho + laranja
- Sidebar escura (dark navy) com texto branco e accent laranja
- Botoes primarios em laranja, hover em laranja escuro
- Cards com borda sutil e sombra leve em fundo branco puro
- Atualizar paleta dark mode para manter coerencia

### 2. Sidebar (`src/components/AppSidebar.tsx`)
- Trocar titulo "Contabil Gestao" por "Velocitä"
- Adicionar icone/logo estilizado (barras verticais em laranja)
- Melhorar espacamento e hover states dos itens de menu
- Avatar com borda laranja no footer
- Separador visual entre grupos de menu

### 3. Layout Principal (`src/components/AppLayout.tsx`)
- Header com breadcrumb ou titulo da pagina atual
- Sombra sutil no header para separacao visual
- Padding e espacamento mais generosos

### 4. Tela de Login (`src/pages/Auth.tsx`)
- Layout split-screen: lado esquerdo com branding Velocitä (fundo marinho, logo, tagline)
- Lado direito com formulario em fundo branco
- Botao de login em laranja

### 5. Dashboard (`src/pages/Dashboard.tsx`)
- Saudacao personalizada ("Bom dia, [nome]")
- KPI cards com icones em circulos coloridos e borda left accent
- Cores dos graficos alinhadas a paleta (laranja para receitas, azul para despesas)
- Cantos mais arredondados (`--radius: 0.75rem`)

### 6. Paginas de listagem (Clientes, etc.)
- Nenhuma mudanca estrutural, apenas herdam as novas cores via tokens
- Badges com cores da nova paleta

## Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| `src/index.css` | Paleta completa light/dark Velocitä |
| `src/components/AppSidebar.tsx` | Branding, logo, espacamento |
| `src/components/AppLayout.tsx` | Header melhorado |
| `src/pages/Auth.tsx` | Layout split-screen com branding |
| `src/pages/Dashboard.tsx` | Saudacao, KPI cards modernos |

Nenhuma dependencia nova necessaria. Todas as mudancas usam os design tokens existentes via CSS variables.

