

## Diagnóstico: Campos estão no código mas não visíveis

Analisei o código e os campos **estão implementados corretamente** no `Clients.tsx` (linhas 530-576):
- Data de Abertura (linha 532)
- Veio de outro escritório? + Nome do escritório anterior (linhas 564-576)
- Motivo da Saída + campos condicionais (linhas 535-561)

O problema é que esses campos ficam **abaixo da área visível** na aba "Geral" do dialog. O dialog tem `max-h-[90vh] overflow-y-auto`, mas a aba Geral tem muitos campos e o usuário precisa rolar para baixo para vê-los.

### Plano de correção

**Reorganizar a aba Geral** para melhor visibilidade:

1. **Mover os campos novos para uma posição mais visível** — colocar "Data de Abertura" ao lado de "Data Início" e "Data Saída" (na mesma linha do grid), e mover "Veio de outro escritório?" para logo depois das datas, antes das observações.

2. **Agrupar com separadores visuais** — adicionar subtítulos (ex: "Datas", "Origem/Saída") para organizar melhor os campos dentro da aba Geral, tornando claro onde cada informação está.

3. **Garantir scroll visível** — adicionar padding ou indicador visual para que o usuário saiba que há mais campos abaixo.

Alteração em: `src/pages/Clients.tsx` — reorganização do layout da aba Geral.

