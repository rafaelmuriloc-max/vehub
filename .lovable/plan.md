

# Melhorar o Dialog de Importação de Certificados A1

## Problemas identificados (pela screenshot)

1. O dialog não é responsivo -- a tabela não se adapta a telas menores
2. Layout da tabela com colunas cortadas (vencimento cortado)
3. Falta de visual hierarchy -- contadores no topo sem destaque
4. Sem scroll horizontal na tabela em telas pequenas
5. O dialog usa `max-w-4xl` fixo sem adaptação mobile

## Melhorias planejadas

### Layout responsivo
- Dialog: usar `w-[95vw] max-w-5xl` para ocupar melhor o espaço disponível
- Em mobile: trocar a tabela por cards empilhados (cada certificado vira um card com as infos em stack vertical)
- Usar `hidden sm:table-cell` para ocultar colunas menos importantes em telas pequenas

### Visual melhorado
- Contadores de status (novos/existentes/ignorados/erros) em cards coloridos com ícones em vez de texto simples
- Badges de status mais claros com ícones
- Arquivo com nome truncado via `truncate` + tooltip
- Coluna de vencimento com indicação visual (cor verde se válido, amarelo se próximo do vencimento)
- Scroll horizontal na tabela como fallback (`overflow-x-auto`)

### Responsividade mobile
- Breakpoint `md:` para alternar entre cards e tabela
- Botões de ação em full-width no mobile
- Espaçamento e padding ajustados

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/components/CertificateImportDialog.tsx` | Reescrever o layout do preview com cards de status, tabela responsiva com scroll horizontal, cards em mobile, e melhor hierarquia visual |

