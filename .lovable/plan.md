## Objetivo

Adicionar um botão na conversa (cabeçalho) para cadastrar/atualizar o contato do número que está conversando, com vínculo opcional a uma Empresa e a um Departamento.

## UX

Botão **"Cadastrar contato"** (ícone `UserPlus`) no header de `MessageArea`, exibido somente quando `whatsappPhone` existe. Ao clicar abre um dialog `RegisterContactDialog`:

Campos:
- **Nome** (texto, pré-preenchido com `conversationName`)
- **Telefone** (texto, pré-preenchido com `whatsappPhone`, formato canônico `55+DDD+9+número`)
- **E-mail** (texto, opcional)
- **Empresa** — Combobox com busca em `clients.company_name` (segue padrão `Searchable Selects` da memória)
- **Departamento** — Combobox com busca em `departments.name` (carregado quando uma empresa estiver selecionada; opcional)

Botões: Cancelar / Salvar.

## Regra de gravação

Sem migração de banco — usar tabelas existentes.

1. **Empresa + Departamento selecionados** → `INSERT` em `client_department_contacts (client_id, department_id, contact_name, contact_phone, contact_email)`. Como agora aceitamos múltiplos contatos por departamento (fix recente), basta inserir uma nova linha. Verificar duplicidade pelo telefone normalizado antes de inserir.
2. **Apenas Empresa (sem departamento)** → se o cliente ainda não tem `contact_phone`, atualizar `clients.contact_name/phone/email`; caso contrário, gravar como `client_department_contacts` com `department_id = NULL`? Não — `department_id` é NOT NULL. Então neste caso apenas vincula a conversa ao cliente (`chat_conversations.client_id`) e atualiza os campos `contact_*` do cliente se estiverem vazios. Se já preenchidos, mostrar toast informando "Cliente já possui contato; selecione um departamento para adicionar mais um contato".
3. **Sem empresa** → toast: "Selecione uma empresa para vincular o contato" (sem destino para gravar; ou alternativamente permitir só atualizar o nome da conversa). Manter simples: empresa é obrigatória.

Em todos os casos com empresa selecionada, atualizar `chat_conversations.client_id` da conversa atual para o `client_id` escolhido (e `name_locked = true`, `name = contact_name`).

## Arquivos a alterar

1. **Criar `src/components/chat/RegisterContactDialog.tsx`** — dialog com Combobox de empresas/departamentos e mutações (Supabase).
2. **`src/components/chat/MessageArea.tsx`** — adicionar prop `onRegisterContact` e botão `UserPlus` no header (escondido quando `isClosed` ou sem `whatsappPhone`).
3. **`src/pages/Chat.tsx`** — controlar abertura do dialog, passar `whatsappPhone`, `conversationName`, `conversationId` ao dialog; após salvar, recarregar lista/header (já existe sync realtime).

## Resumo

- Novo botão "Cadastrar contato" no header da conversa.
- Dialog com Nome, Telefone, E-mail, Empresa (busca), Departamento (busca).
- Empresa obrigatória; com departamento → grava em `client_department_contacts`; sem departamento → atualiza `clients.contact_*` (se vazio) e vincula a conversa ao cliente.
- Sem mudanças de schema; reaproveita tabelas existentes.
