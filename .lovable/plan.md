# Relatório PDF na página de Chamados

Adicionar um botão "Relatório PDF" na página `/tickets` que gera um PDF com os chamados conforme os filtros selecionados na tela.

## Como vai funcionar

- Botão no cabeçalho, ao lado de "Atualizar" e "Gerar chamados de hoje".
- Ao clicar, busca **todos** os chamados que atendem aos filtros atuais (período, situação, responsável, departamento e busca) — não apenas a página exibida.
- Gera e baixa um PDF chamado `Chamados_AAAA-MM-DD.pdf`.

## Conteúdo do PDF

- Cabeçalho com título "Relatório de Chamados", data/hora de geração e os filtros aplicados escritos por extenso (ex.: "Período: Últimos 7 dias · Situação: Encerrados · Responsável: Todos").
- Resumo: total de chamados, abertos, encerrados, duração média de atendimento e tempo médio de espera.
- Tabela com uma linha por chamado: nº, abertura, fechamento, duração, contato, empresa, departamento, responsável, situação e assunto.
- Rodapé com numeração de páginas; quebra automática de página no formato paisagem A4.

## Técnico

- Arquivo alterado: `src/pages/Tickets.tsx` (apenas frontend).
- Usar `jspdf` (já no projeto) com `jspdf-autotable` para a tabela; se preferir evitar nova dependência, a tabela é desenhada manualmente com `doc.text` e linhas — decisão de implementação, sem impacto visual relevante.
- Reaproveitar `fmtDate`, `fmtDuration`, `ticketDuration`, `clientMap`, `deptMap` e `profileMap` já existentes na página.
- A consulta do relatório reutiliza a mesma montagem de filtros da query atual, sem `range` (limite de segurança de 2000 registros).
- Sem alterações de banco de dados ou edge functions.
