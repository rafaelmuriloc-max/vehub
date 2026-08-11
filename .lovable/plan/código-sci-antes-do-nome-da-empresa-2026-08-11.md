# Código SCI antes do nome da empresa

Padronizar a exibição de empresas em todo o sistema como `211 - EMPRESA X`. Quando a empresa não tiver código SCI cadastrado, mostra apenas o nome.

## Como vai funcionar

- Um único formatador central passa a montar o rótulo da empresa (código + hífen + nome).
- Todas as telas que hoje mostram razão social passam a usar esse formatador: Clientes, Calendário, Obrigações, Tarefas, Documentos, Chat (lista, painéis e diálogos), Financeiro (cobranças, recorrências, DRE), Fiscal/Notas (NFe, NFSe, Simples Nacional, Integra Contador), Mensagens agendadas e E-mail.
- Seletores/comboboxes de empresa também exibem o código, e a busca continua funcionando por nome, CNPJ e código SCI.
- Documentos gerados (contrato em PDF e telas de emissão de nota) exibem o código junto ao nome nos cabeçalhos/listagens de identificação da empresa. Observação: em campos oficiais da nota fiscal (razão social do tomador/prestador enviada ao município), o nome continua sem o código, para não invalidar a emissão.
- Mensagens de WhatsApp e e-mail enviadas ao cliente permanecem sem o código (não foi pedido e é informação interna).

## Detalhes técnicos

1. `src/lib/utils.ts`: adicionar `formatClientLabel(client?: { sci_code?: string | null; company_name?: string | null })` retornando `"211 - EMPRESA X"` ou só o nome quando `sci_code` for vazio/nulo.
2. Ajustar cada consulta Supabase que hoje busca `company_name` (ou `clients(company_name)`) para incluir também `sci_code`, e tipar os objetos locais com o campo novo.
   Arquivos envolvidos: `src/pages/Clients.tsx`, `CalendarView.tsx`, `Obligations.tsx`, `Tasks.tsx`, `Documents.tsx`, `Chat.tsx`, `Financial.tsx`, `Email.tsx`, `IntegraContador.tsx`, `InvoiceEmit.tsx`, `ScheduledMessages.tsx`, `src/components/ClientObligationsTab.tsx`, `DocumentReviewDialog.tsx`, `ContractTab.tsx`, `tasks/TaskEditDialog.tsx`, `chat/*` (NewConversationDialog, RegisterContactDialog, PendingTasksPanel, TaskRequestForm, AttachFromObligationDialog, AttachSocietyDocumentsDialog), `financial/AsaasChargesTab.tsx`, `financial/RecurringEntriesTab.tsx`, `invoices/NfeTab.tsx`, `invoices/NfseTab.tsx`, `simples-nacional/SimplesNacionalTab.tsx`, `simples-nacional/ReprocessChainDialog.tsx`, `integra-contador/SituacaoFiscalTab.tsx`, `integra-contador/RfbParcelamentos.tsx`, `dashboard/ObligationsPanel.tsx`.
3. Substituir as renderizações diretas de `company_name` por `formatClientLabel(...)`, mantendo colunas dedicadas de "Código SCI" onde já existem (ex.: tabela de Clientes) sem duplicar visualmente — nessa tabela o nome recebe o prefixo e a coluna separada é mantida.
4. Ordenações por nome passam a considerar o rótulo formatado onde a lista é ordenada alfabeticamente por empresa; filtros de busca continuam aceitando nome, CNPJ e código SCI.
5. Não alterar `src/lib/sendActivityWhatsApp.ts`, `sendActivityEmail.ts` nem os payloads enviados a SERPRO/Asaas/municipal — apenas apresentação na interface.
