# Plano: Deixar a aba NF-e com o mesmo layout da NFS-e

## Objetivo
Replicar na aba NF-e (`NfeTab`) o visual e a organização já aplicados na NFS-e (`NfseTab`): card de consulta estilizado, filtros abaixo do card, resumos azul/laranja, abas sublinhadas com contadores e colunas contextuais, além de definir o mês atual como filtro padrão.

## O que será alterado

### 1. `src/components/invoices/NfeTab.tsx`
- **Filtro padrão:** `datePeriod` passa a iniciar em `'this_month'`, com `filterDateFrom` e `filterDateTo` no primeiro e último dia do mês atual.
- **Card de consulta:** substituir o card simples "Consultar NF-e" pelo padrão da NFS-e: ícone em círculo com fundo `muted`, título "Consultar NF-e no Ambiente Nacional", seletor de cliente, seletor de período de sincronização (últimos 90 dias / este mês / mês anterior / personalizado), inputs de data quando aplicável e botão "Buscar NF-e" alinhado à direita.
- **Barra de filtros da lista:** mover os controles de período, datas personalizadas, cliente e botões de download em lote (XML/PDF) de dentro do card da tabela para uma barra logo abaixo do card de consulta, com título "Notas Fiscais" à esquerda e controles à direita.
- **Painéis de resumo:** criar duas seções estilizadas (azul para Entradas, laranja para Saídas), cada uma com cards de estatísticas: Total de Notas, Valor Total e Valor Médio. Manter a mesma linguagem visual da NFS-e (borda lateral, fundo suave, ícones em círculos).
- **Abas da lista:** substituir o `TabsList` padrão dentro do card por abas sublinhadas "Entradas (N)" / "Saídas (N)", semelhante a "Prestados/Tomados".
- **Colunas contextuais:** na tabela, mostrar uma única coluna de contraparte que muda conforme a aba ativa:
  - Entradas: **Emitente**
  - Saídas: **Destinatário**
  Manter coluna "Cliente" visível apenas em telas grandes.
- **Ajustes de comportamento:** garantir que a paginação volte para a página 1 ao trocar de aba, período, cliente ou datas; manter os downloads em lote operando sobre a lista filtrada.

### 2. Validação
- Rodar `tsgo` para validação de tipos.
- Verificar `build-errors.log` após o build automático.
- Se o ambiente permitir, capturar screenshot do preview na aba NF-e para confirmar o novo layout.

## Notas técnicas
- As cores devem seguir os tokens semânticos do projeto; os painéis azul/laranja usarão as mesmas classes de variante já presentes na NFS-e (`blue`/`orange`), sem hardcode de cores fora do design system.
- O componente de resumo da NF-e será criado localmente em `NfeTab.tsx`, pois o `ServiceSummarySection` da NFS-e é específico para retenções de serviços.
- Nenhuma alteração em edge functions, banco de dados ou rotas é necessária.
