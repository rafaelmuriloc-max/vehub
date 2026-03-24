

# Seleção de Obrigações por Departamento no Cadastro do Cliente

## Objetivo
Na aba "Contatos" do cadastro de cliente, abaixo dos campos de contato de cada departamento, exibir checkboxes com as obrigações daquele departamento para que o usuário selecione quais se aplicam ao cliente.

## Mudanças

### 1. Migration: Criar tabela `client_department_obligations`

Nova tabela de vínculo entre cliente, departamento e obrigação:

```sql
CREATE TABLE client_department_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  obligation_id uuid NOT NULL REFERENCES obligations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, department_id, obligation_id)
);

-- RLS policies (same pattern as other tables)
ALTER TABLE client_department_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view" ON client_department_obligations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert" ON client_department_obligations
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete" ON client_department_obligations
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
```

### 2. Atualizar `src/pages/Clients.tsx`

- **Carregar obrigações por departamento**: Fetch `obligations` agrupadas por `department_id`.
- **Carregar vínculos existentes**: Quando editando, fetch `client_department_obligations` do cliente.
- **State**: Adicionar `obligations` (lista) e `selectedObligations` (Set de obligation_ids selecionados).
- **UI na aba Contatos**: Abaixo dos campos de contato de cada departamento, listar as obrigações daquele departamento como checkboxes. Cada checkbox marca/desmarca a obrigação para o cliente.
- **Save**: No `handleSave`, sincronizar os vínculos -- deletar os desmarcados e inserir os marcados (ou fazer delete all + insert dos selecionados).

### Detalhes técnicos

```text
Aba Contatos - Layout por departamento:

┌─────────────────────────────────────────────┐
│ Departamento Fiscal                         │
│ [Nome contato] [Telefone] [E-mail]          │
│                                             │
│ Obrigações:                                 │
│ ☑ DCTF Mensal  ☑ ECD  ☐ ECF  ☑ SPED Fiscal│
└─────────────────────────────────────────────┘
│ Departamento Pessoal                        │
│ [Nome contato] [Telefone] [E-mail]          │
│                                             │
│ Obrigações:                                 │
│ ☑ eSocial  ☐ RAIS  ☑ CAGED                │
└─────────────────────────────────────────────┘
```

- As obrigações já possuem `department_id`, então o filtro é direto.
- O save faz `DELETE FROM client_department_obligations WHERE client_id = X` seguido de bulk insert dos selecionados.
- Os checkboxes ficam desabilitados em modo `viewOnly`.

