## Objetivo

Substituir os 5 cards de resumo (A Fazer, Após Início, Após Meta, Atrasadas, Concluídas) na página `/calendar` pelo layout moderno do protótipo "Card refinado" selecionado.

## Mudanças

Arquivo: `src/pages/CalendarView.tsx` (bloco entre linhas 688-709)

1. **Reescrever a config dos cards** com tokens completos por status (background tintado, borda, cor do tile de ícone, cor do label, cor do valor, cor da sub-linha, trilho e barra de progresso). Adicionar suporte ao modo escuro.

2. **Calcular percentuais reais** para a barra de progresso de cada card:
   - `grandTotal = todo + afterAlert + afterTarget + overdue + (doneOnTime + doneLate)`
   - `pct(v) = round(v / grandTotal * 100)`

3. **Atualizar as sub-legendas dinâmicas**:
   - A Fazer: "Nenhuma pendência" se 0, senão "Aguardando início"
   - Após Início: "Nenhuma pendência" se 0, senão "Em andamento"
   - Após Meta: "Sem alertas" se 0, senão "Requer atenção"
   - Atrasadas: "Tudo em dia" se 0, senão "Crítico"
   - Concluídas: "X no prazo • Y fora"

4. **Novo markup do card**, espelhando o protótipo:
   - Container `rounded-2xl border p-5` com fundo tintado, hover com `shadow-lg` e `-translate-y-0.5`
   - Tile de ícone `w-12 h-12 rounded-xl` colorido sólido com `shadow-md` e ícone branco 24px
   - Label (xs/sm, semibold, tinted) acima do número (3xl, bold)
   - Sub-linha discreta `mt-auto`
   - Barra de progresso final `h-1.5 rounded-full` com trilho tintado e preenchimento sólido pela cor do status

5. **Grid responsivo**: `grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4` (mantendo 2 colunas no mobile).

Nenhuma alteração de lógica de negócio, de dados ou de outras seções da página.
