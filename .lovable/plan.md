

# Adicionar campos de Responsável na seção de Certificados

## O que será feito
Adicionar dois campos editáveis (Nome e Telefone do responsável pela emissão dos certificados) na seção de vencimento de certificados da página de Clientes. Os dados serão persistidos na tabela `company_settings`.

## 1. Migração de banco de dados
Adicionar duas colunas à tabela `company_settings`:
- `cert_responsible_name` (text, nullable)
- `cert_responsible_phone` (text, nullable)

## 2. Alterações em `src/pages/Clients.tsx`

### Estado e carregamento
- Adicionar estado `certResponsible` com `name` e `phone`
- Carregar os valores de `company_settings` no `useEffect` de inicialização (já existe query similar no projeto)
- Função `saveCertResponsible` para atualizar os campos via `supabase.from('company_settings').update(...)`

### UI
Inserir entre o header (badges de resumo) e a tabela de certificados, dois campos inline:

```text
Responsável: [___Nome___]  Telefone: [___Telefone___]  [Salvar]
```

- Dois `Input` em linha (flex row) com labels compactos
- Botão "Salvar" que persiste os dados
- Toast de confirmação ao salvar

## Arquivos alterados
- Migração SQL — 2 colunas em `company_settings`
- `src/pages/Clients.tsx` — ~20 linhas adicionadas

