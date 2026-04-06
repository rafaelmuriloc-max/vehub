

# Ajustar colunas das tabelas de notas fiscais para caber na tela

## Problema
Na tela atual (~1267px), todas as colunas são visíveis mas as últimas ("Status", "Ações") ficam cortadas à direita. Nomes longos de clientes e a coluna "Descrição" consomem espaço excessivo.

## Alterações

### 1. `src/components/invoices/NfseTab.tsx`

**Reduzir largura de colunas largas:**
- Coluna "Cliente": adicionar `max-w-[150px] truncate` para limitar nomes longos
- Coluna "Descrição": reduzir `max-w-[200px]` para `max-w-[150px]`, e esconder em telas menores que `lg` em vez de `md` (`hidden lg:table-cell`)
- Coluna "Impostos": esconder abaixo de `lg` (`hidden lg:table-cell`)
- Coluna "Status": manter `hidden md:table-cell`

**Reduzir padding da tabela:**
- Adicionar `text-sm` ao `<Table>` para texto mais compacto

### 2. `src/components/invoices/NfeTab.tsx`

**Mesmos ajustes de breakpoint:**
- Colunas secundárias ("Destinatário", "Status"): usar `hidden lg:table-cell` em vez de `hidden md:table-cell` para esconder em telas intermediárias
- Coluna "Emitente": `max-w-[150px] truncate`

## Resultado
Em ~1267px: colunas essenciais (Número, Tipo, Cliente, Data, Valor, Ações) sempre visíveis. Descrição e Impostos aparecem apenas em telas `lg` (1024px+). Status aparece a partir de `md` (768px+).

## Arquivos
- `src/components/invoices/NfseTab.tsx` — ~8 linhas de classes CSS
- `src/components/invoices/NfeTab.tsx` — ~6 linhas de classes CSS

