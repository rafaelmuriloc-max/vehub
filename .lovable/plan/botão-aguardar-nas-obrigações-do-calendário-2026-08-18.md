# Botão "Aguardar" nas obrigações do calendário

Permitir marcar uma obrigação que não pode ser concluída como "Aguardando", com um motivo obrigatório, e listá-la em uma nova aba.

## Comportamento

- Novo botão **Aguardar** (ícone de pausa) nas obrigações do calendário: no card da lista (dia e mês) e no diálogo de detalhes da obrigação.
- Ao clicar, abre um diálogo pedindo o **motivo**. O botão Confirmar fica desabilitado enquanto o motivo estiver vazio (mínimo de texto digitado obrigatório).
- Ao confirmar, a obrigação sai das listas Pendentes/Atrasadas e passa a aparecer na nova aba **Aguardando**, com o motivo, quem colocou em espera e a data/hora.
- Na aba Aguardando cada item mostra o motivo e tem ação **Retomar** (volta para Pendentes) e **Editar motivo**.
- Obrigações aguardando continuam contando o vencimento, mas ficam com badge âmbar "Aguardando" onde aparecerem (ex.: se o filtro por cliente/obrigação as exibir).
- Concluir uma obrigação aguardando limpa automaticamente o estado de espera.
- Ação em massa: com itens selecionados, botão "Aguardar selecionadas" usando o mesmo diálogo de motivo.

## Detalhes técnicos

Banco (`public.obligation_instances`), via migração:
- `on_hold boolean not null default false`
- `hold_reason text`
- `hold_at timestamptz`
- `hold_by uuid` (id do usuário, sem FK para auth.users)

Frontend (`src/pages/CalendarView.tsx`):
- Incluir os novos campos em `instCols` e no tipo `Instance`.
- Derivar `holdInstances` a partir de `instances` (não excluídas, `on_hold = true`) e removê-las das listas de pendentes/atrasadas e dos eventos "pendentes".
- Nova `TabsTrigger value="hold"` ("Aguardando", com contador) na visão mensal, ao lado de Excluídas, com o mesmo layout de lista já usado nas outras abas + linha de motivo.
- Novo componente de diálogo de motivo (reaproveitando `Dialog` + `Textarea`), controlado por estado `holdTarget: string[] | null`.
- Funções `putOnHold(ids, reason)` e `resumeInstance(id)` fazendo update em `obligation_instances` e chamando `loadData()`.
- Em `quickCompleteInstance` / `quickCompleteSelectedInstances` / conclusão via checklist, limpar `on_hold`, `hold_reason`, `hold_at`, `hold_by`.
