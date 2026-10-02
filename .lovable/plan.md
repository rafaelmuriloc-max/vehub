# Avaliação de atendimento por IA (NPS sintético) dentro de Chamados

Cada chamado encerrado passa a receber, automaticamente, uma nota de atendimento dada pela IA com base na conversa (incluindo áudios transcritos). Tudo fica visível na tela de Chamados. Os chamados encerrados nos últimos 30 dias também serão avaliados.

## O que a IA avalia

- **Nota NPS (0 a 10)** de como o cliente provavelmente sairia do atendimento: Promotor (9-10), Neutro (7-8), Detrator (0-6). Avalia a condução do atendimento, não o assunto (ex.: imposto alto não derruba a nota).
- **Pilares (1 a 5):** Empatia, Clareza técnica e Resolução.
- **Humor do cliente** no início e no fim (positivo, neutro, negativo).
- **Pontos fortes** e **ponto de melhoria** em poucas linhas.
- Atendimentos muito curtos (menos de 3 mensagens) ou só com respostas automáticas ficam como **"Não avaliado"** e não entram nas médias.

## Onde aparece (tela Chamados)

1. **Nova aba "Avaliação"** ao lado da lista, com:
   - NPS geral do período (% promotores − % detratores) e média dos pilares;
   - ranking por atendente e por departamento (quantidade avaliada, NPS, média);
   - lista de **atendimentos críticos** (nota 6 ou menor), clicável para abrir o chamado.
   - Respeita os filtros já existentes (período, responsável, departamento).
2. **Na lista de chamados:** um selo colorido com a nota em cada linha.
3. **No detalhe do chamado:** nota, pilares, humor início/fim, pontos fortes e melhoria, e botão "Reavaliar".

## Retroativo

Após publicar, rodar a avaliação para todos os chamados encerrados nos últimos 30 dias, em lotes pequenos para não travar nem gastar além do necessário.

## Detalhes técnicos

- **Banco (migração):** novas colunas em `support_tickets`: `nps_score` (int), `nps_category` (promoter/neutral/detractor), `empathy_score`, `clarity_score`, `resolution_score` (int 1-5), `sentiment_start`, `sentiment_end` (text), `feedback_strengths`, `feedback_improvements` (text), `evaluation_status` (pending/done/not_applicable/failed), `evaluated_at`. Sem nova tabela; RLS atual de leitura se mantém.
- **Edge function `ticket-summarize`:** a mesma chamada de IA que gera assunto/resumo passa a devolver também a avaliação (saída estruturada). Como o código da chamada será alterado, ela passa para o modelo padrão do gateway (`openai/gpt-6-astra` via Responses API, em streaming), seguindo as regras de erro do gateway (402/429 pausam o lote). Novo modo `{ evaluate_backfill: true, days: 30, limit }` que reprocessa chamados fechados sem avaliação; e `{ ticket_id, reevaluate: true }` para o botão "Reavaliar".
- **Frontend:** `src/pages/Tickets.tsx` ganha abas Lista/Avaliação, selo na linha e seção no dialog de detalhe; componente novo `src/components/tickets/TicketEvaluationPanel.tsx` para os indicadores e rankings (cálculos no cliente sobre os chamados filtrados).
- **Publicação:** a função alterada só será publicada com sua autorização; o retroativo roda depois disso.
