## Objetivo
No calendário, exibir um botão **"Sem Movimento"** nas obrigações do tipo *DAS - Simples Nacional*. Ao clicar:
1. Transmite ao SERPRO/PGDAS-D a declaração mensal **sem movimento** daquela competência e cliente.
2. Envia automaticamente uma mensagem ao cliente via **WhatsApp (Evolution API)**.

---

## 1. Identificação da obrigação (slug fixo)

Adicionar coluna `system_code text` em `public.obligations` (nullable, único quando preenchido).
Valor esperado: `das-simples-nacional`.

Na tela de cadastro de obrigações (`src/pages/Obligations.tsx`) acrescentar um Select opcional **"Integração de sistema"** com a opção:
- *DAS – Simples Nacional (PGDAS-D)* → grava `system_code = 'das-simples-nacional'`.

Assim qualquer obrigação marcada com esse código habilita o botão.

---

## 2. Botão "Sem Movimento" no calendário

Arquivo: `src/pages/CalendarView.tsx`.

Mostrar o botão quando `obligation.system_code === 'das-simples-nacional'` e a instância ainda não estiver concluída:

- **No card/linha do calendário** (lista de eventos do dia): badge-button compacto ao lado dos demais ícones.
- **No dialog de detalhe da obrigação**: botão destacado no topo (`variant="outline"` com ícone `FileX`).

Fluxo do clique:
1. Confirmação (`AlertDialog`): "Declarar sem movimento e avisar o cliente?"
2. Chama edge function `pgdasd-sem-movimento` (nova) com `{ client_id, instance_id, reference_month }`.
3. Em caso de sucesso: marca a `obligation_instance` como concluída (`status='done'`, `completion_kind='sem_movimento'`) e dispara toast.
4. Erro: toast com a mensagem do SERPRO.

---

## 3. Edge Function `pgdasd-sem-movimento`

Nova função em `supabase/functions/pgdasd-sem-movimento/index.ts`. Faz tudo server-side:

1. Valida JWT do usuário e busca o cliente (CNPJ, razão social, telefones, departamento).
2. Monta o JSON do PGDAS-D **sem movimento** (apenas cabeçalho, sem `receitasBrutas` nem estabelecimentos com receita).
3. Reaproveita a função `integra-contador` invocando-a internamente com:
   ```json
   { "client_id": "...", "idSistema": "PGDASD", "idServico": "TRANSDECLARACAO11",
     "tipo": "Declarar", "versaoSistema": "1.0", "dados": "<json>" }
   ```
4. Se SERPRO retornar sucesso:
   - Grava log em `simples_nacional_competencias` (ou tabela equivalente já existente) marcando `sem_movimento=true` e o número do recibo.
   - Marca a `obligation_instance` correspondente como `done` + `completion_kind='sem_movimento'`.
   - Dispara mensagem WhatsApp via Evolution API (segredos `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` já existem) para o telefone principal do cliente.
5. Retorna `{ success, receipt?, whatsapp_sent, errors? }`.

### Texto da mensagem
```
Olá! 👋

Informamos que a empresa *{razao_social}* não emitiu notas fiscais na competência *{MM/AAAA}*.
Por esse motivo, o *Simples Nacional* foi declarado como *sem movimentação* junto à Receita Federal.

Caso identifique alguma divergência, entre em contato com nossa equipe o quanto antes.

Atenciosamente,
{nome_do_escritorio}
```
Variáveis preenchidas a partir de `clients` e `company_settings`.

---

## 4. Banco de dados (migração)

```sql
ALTER TABLE public.obligations
  ADD COLUMN IF NOT EXISTS system_code text;

CREATE UNIQUE INDEX IF NOT EXISTS obligations_system_code_unique
  ON public.obligations(system_code) WHERE system_code IS NOT NULL;
```
(Sem novas tabelas; grants e RLS já existentes seguem válidos.)

---

## 5. Arquivos afetados
- **Migration nova** (coluna `system_code`).
- `src/pages/Obligations.tsx` — campo de cadastro do código de sistema.
- `src/pages/CalendarView.tsx` — botão "Sem Movimento" (card + dialog) e chamada à edge function.
- `supabase/functions/pgdasd-sem-movimento/index.ts` — nova função (orquestra SERPRO + WhatsApp).
- (Opcional) ajuste em `src/integrations/supabase/types.ts` é automático.

Nenhuma alteração no `IntegraContador` ou no `PgdasdDeclaracaoForm` existentes.