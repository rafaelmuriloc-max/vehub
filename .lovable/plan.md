## Objetivo

Fazer com que qualquer texto entre `{{ }}` nas mensagens enviadas (WhatsApp e E-mail) seja interpretado como variável e substituído pelos dados reais da tarefa/cliente/obrigação no momento do envio.

## Variáveis suportadas (conjunto completo)

| Variável | Conteúdo |
|---|---|
| `{{cliente}}` | Razão social do cliente |
| `{{cnpj}}` | CNPJ formatado `XX.XXX.XXX/XXXX-XX` |
| `{{tarefa}}` | Título da tarefa / nome da obrigação |
| `{{vencimento}}` | Data de vencimento `dd/mm/aaaa` |
| `{{descricao}}` | Descrição da tarefa |
| `{{responsavel}}` | Nome do responsável (criador da tarefa, ou usuário corrente para atividades) |
| `{{data_hoje}}` | Data atual `dd/mm/aaaa` |
| `{{competencia}}` | Mês/ano de competência (atividades de obrigações) |

A substituição é tolerante: variáveis desconhecidas ficam vazias; `{{ Cliente }}` (com espaços/maiúsculas) também funciona.

## Onde aplicar

1. **`supabase/functions/task-notify-client/index.ts`** (notificação manual da tarefa ao cliente — WhatsApp + E-mail):
   - Carregar `tasks.title, description, due_date, created_by` + `clients.company_name, cnpj` + `profiles.full_name` do criador.
   - Construir mapa de variáveis e aplicar em `notify_message` e `notify_email_subject` (assunto) antes de enviar texto WhatsApp e antes de montar o `html` do e-mail.

2. **`src/lib/sendActivityEmail.ts`** e **`src/lib/sendActivityWhatsApp.ts`** (atividades automáticas das obrigações):
   - Adicionar as chaves `{{cliente}}, {{cnpj}}, {{tarefa}}, {{vencimento}}, {{descricao}}, {{responsavel}}, {{data_hoje}}, {{competencia}}` ao mapa `variables` existente, mantendo as variáveis atuais em colchetes `[...]` para retrocompatibilidade.
   - Trocar a substituição por uma função única que suporta os dois formatos e é case-insensitive para `{{...}}`.

3. **UI — `src/pages/Tasks.tsx`** (apenas dica visual, sem mudança de lógica):
   - Sob o campo "Mensagem ao cliente" do dialog de cadastro de tarefa, exibir um pequeno texto auxiliar listando as variáveis disponíveis (ex.: "Variáveis: `{{cliente}}`, `{{cnpj}}`, `{{tarefa}}`, `{{vencimento}}`, `{{descricao}}`, `{{responsavel}}`, `{{data_hoje}}`").

## Detalhes técnicos

- Helper único `applyTemplateVars(text, vars)` em cada arquivo (edge function em Deno, libs no front) com regex `/\{\{\s*([\w_]+)\s*\}\}/gi` que faz lookup case-insensitive no mapa.
- Formatação de CNPJ no edge function: `cnpj.replace(/\D/g,'').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5')`.
- Formatação de datas em pt-BR: `new Date(...).toLocaleDateString('pt-BR')`.
- Sem migrações de banco; sem novas dependências; sem mudança de schema.

## Fora de escopo

- Não alterar o fluxo de envio nem os anexos.
- Não mexer nos templates do WhatsApp Cloud (mensagens de modelo aprovadas pela Meta usam `{{1}}`, `{{2}}` posicionais — isso continua intocado).
