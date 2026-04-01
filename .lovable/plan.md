

# Clonar Obrigação

## O que será feito
Adicionar um botão "Clonar" ao lado dos botões Editar/Excluir de cada obrigação. Ao clicar, o sistema cria uma cópia da obrigação (com nome "[nome] (cópia)") e todas as suas atividades vinculadas.

## Alterações

### `src/pages/Obligations.tsx`

1. **Importar ícone `Copy`** do lucide-react
2. **Criar função `cloneObligation(ob: Obligation)`**:
   - Inserir nova obrigação com os mesmos dados (nome com sufixo " (cópia)")
   - Buscar todas as atividades da obrigação original
   - Inserir cópias das atividades vinculadas à nova obrigação
   - Recarregar dados com `loadAll()`
3. **Adicionar botão Clone** na linha de ações (entre Editar e Excluir), visível apenas para admin

## Arquivos
- `src/pages/Obligations.tsx`

