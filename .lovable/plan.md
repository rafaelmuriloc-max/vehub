## Melhorias de layout no diálogo "Anexar arquivo de obrigação"

Problema: nomes longos de arquivos vazam, botões do rodapé estouram a largura e ficam cortados, e o nome da empresa fica truncado.

### Mudanças em `src/components/chat/AttachFromObligationDialog.tsx`

1. **Aumentar largura do diálogo** — trocar `sm:max-w-md` por `sm:max-w-lg` no `DialogContent` para acomodar nomes mais longos.

2. **Garantir truncamento nos triggers de Empresa e Obrigação** — adicionar `min-w-0` nos containers e manter `truncate` no `<span>` interno para evitar overflow horizontal.

3. **Lista de arquivos**
   - Adicionar `min-w-0` no wrapper para o `truncate` funcionar corretamente.
   - Aumentar `max-h-48` para `max-h-56` e manter `overflow-y-auto`.
   - Mostrar nome do arquivo com `break-all` em uma linha apenas se necessário, ou usar `truncate` com `title={fileName}` para exibir o nome completo no hover.

4. **Rodapé responsivo**
   - Trocar a ordem para `flex-col-reverse sm:flex-row sm:justify-end` (já é o default do `DialogFooter`).
   - Adicionar `flex-wrap` para permitir quebra dos botões quando o espaço for insuficiente.
   - Encurtar rótulos: "Enviar todos (N)" mantém; "Enviar selecionados (N)" passa a "Enviar selecionados" sem o sufixo redundante quando count = 0; manter contador quando > 0.
   - Garantir que cada botão tenha `whitespace-nowrap` (já é padrão do Button) e `min-w-0` no container.

5. **Header de "Selecionar todos"** — manter, mas com `text-sm` e padding consistente.

Sem mudanças de lógica/negócio. Apenas ajustes de classes Tailwind.
