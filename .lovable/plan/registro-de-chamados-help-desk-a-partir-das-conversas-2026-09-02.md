# Registro de chamados (help desk) a partir das conversas

Hoje as conversas do chat funcionam como chamados (aberto/fechado, atribuição, espera), mas nada fica registrado depois que a conversa é fechada. A proposta cria um histórico real de chamados, com resumo automático do assunto.

## Como vai funcionar

1. Toda conversa iniciada gera automaticamente um chamado com número sequencial, data de abertura, contato/empresa, departamento e responsável.
2. Enquanto a conversa está aberta, o chamado acompanha o responsável atual e o departamento da triagem.
3. Ao fechar a conversa (manualmente no chat ou automaticamente por inatividade), o chamado é encerrado: grava data de encerramento, tempo total de atendimento, quantidade de mensagens e um resumo do assunto tratado gerado por IA (mesmo gateway já usado pela Gisele).
4. Se a conversa for reaberta, o chamado encerrado permanece no histórico e um novo chamado é aberto para o novo atendimento (assim o histórico por assunto fica correto).

## Onde ver

- No card "Chamados" do Dashboard entra o botão "Ver chamados".
- O botão abre a tela de chamados com:
  - lista paginada (número, data de abertura/encerramento, contato, empresa, departamento, responsável, status, resumo curto);
  - filtros por período, status, responsável, departamento e busca por texto/empresa/telefone;
  - clique na linha abre o detalhe com o resumo completo, tempos de espera/atendimento e link para abrir a conversa no chat.

## Chamados de hoje

Após a estrutura pronta, os chamados serão criados retroativamente para todas as conversas com mensagens de hoje (abertas e fechadas), com resumo gerado a partir das mensagens do dia.

## Detalhes técnicos

- Nova tabela `public.support_tickets`: `ticket_number` (sequencial), `conversation_id`, `client_id`, `contact_name`, `contact_phone`, `department_id`, `assigned_to`, `status` (`open`/`closed`), `opened_at`, `closed_at`, `first_response_at`, `wait_seconds`, `handle_seconds`, `messages_count`, `summary`, `subject`, `category`, timestamps + trigger de `updated_at`. GRANTs para `authenticated`/`service_role` e RLS: leitura para usuários autenticados, escrita apenas via funções internas/service role (mesma linha das políticas atuais de chat).
- Triggers em `chat_conversations`:
  - `AFTER INSERT` → cria chamado aberto;
  - `AFTER UPDATE` quando `status` vai para `closed` → encerra o chamado aberto (datas/tempos) e dispara `net.http_post` para a edge function de resumo;
  - `AFTER UPDATE` quando volta para `open` → cria novo chamado;
  - sincroniza `assigned_to`/`triaged_department_id` no chamado aberto.
- Nova edge function `ticket-summarize`: recebe `ticket_id`, carrega as mensagens da conversa (ignorando apagadas), chama o Lovable AI Gateway (`google/gemini-2.5-flash`) pedindo assunto curto + resumo em 2-4 linhas + categoria, e grava em `support_tickets`. Também aceita `backfill: true` com intervalo de datas para gerar os chamados retroativos de hoje.
- Front-end: `src/components/dashboard/TicketsPanel.tsx` ganha o botão "Ver chamados"; nova página `src/pages/Tickets.tsx` (rota `/tickets` em `App.tsx`, item no `AppSidebar`) com a lista, filtros e dialog de detalhe, seguindo o padrão visual das demais telas (abas sublinhadas, `formatClientLabel` para empresas).
