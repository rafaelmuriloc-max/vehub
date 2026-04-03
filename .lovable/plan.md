

# Refatoração visual da listagem de obrigações

Alteração puramente visual — nenhuma função, estado, hook ou chamada Supabase será modificada. Apenas o JSX e classes CSS da seção de listagem (linhas 416-536) serão reescritos.

## O que muda

### 1. Barra de filtros (linha 418-424)
Manter header existente (título + botão Nova Obrigação). Abaixo, adicionar barra flex horizontal com:
- Input de busca com ícone Search absoluto à esquerda, estilo customizado (border `#E3E8F2`, radius 10px, focus laranja `#E8710A`)
- Divider vertical 1px × 28px `#E3E8F2`
- Selects de filtro (departamento, frequência) com mesma estética

**Nota**: a busca e filtros serão visuais apenas — usarão `useState` local para filtrar `groupedByDept` sem alterar dados ou lógica existente. Dois novos estados locais: `searchTerm` e `filterDept`.

### 2. Seções por departamento (linhas 429-536)
Substituir `<Card>` + `<CardHeader>` + `<CardContent>` por:

**Header da seção**: barra vertical 3px colorida + nome uppercase 12px 600 + pill de contagem

**Card da seção**: div branco com `border: 1px solid #E3E8F2`, `border-left: 3px solid [cor]`, `border-radius: 14px`, sombra sutil. Sem padding — linhas preenchem.

Cores: mapa por nome de departamento, com fallback. "Fiscal" → `#6366F1`, "Pessoal" → `#0EA5E9`, outros → `#8B5CF6`, etc.

### 3. Cada linha de obrigação (linhas 440-531)
Layout flex horizontal com padding `13px 18px`, `border-bottom: 1px solid #E3E8F2`, última sem border. Hover `#F0F3FA`.

Elementos em ordem:
1. **Chevron** 18×18 com transição rotate(90deg) e cor laranja quando aberto
2. **Ícone** em caixa 34×34 com fundo `#F0F3FA` e border
3. **Nome** flex-1, 14px 500, truncate
4. **Badge frequência** pill outline com fundo `#F0F3FA`
5. **Badge tipo imposto** (se `is_tax`) pill com fundo `#EEF2FF` cor `#4338CA`
6. **Badge clientes** com ícone Users
7. **Grupo de badges prazo** (alert/target/due) com dots coloridos verde/âmbar/vermelho
8. **Botões ação** (editar/clonar/excluir) — `opacity-0 group-hover:opacity-100` com cores específicas por ação

### 4. Conteúdo accordion expandido (linhas 471-530)
Fundo gradiente `linear-gradient(to bottom, #F0F3FA, #F5F7FC)`, border-top, padding esquerdo 64px. Grid 3 colunas com labels uppercase 10.5px e valores 13px. Animação max-height 300ms.

A tabela de atividades mantém a mesma estrutura, apenas dentro do novo container.

## Arquivos alterados
- `src/pages/Obligations.tsx` — apenas o JSX de retorno (linhas ~416-536), adição de 2 estados locais para busca/filtro visual, e constante de cores por departamento

