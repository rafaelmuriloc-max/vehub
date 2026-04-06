
# Seção de controle de vencimento de certificados digitais

## O que será feito
Adicionar uma nova seção na página de Clientes, entre os gráficos e a tabela de clientes, com uma lista de empresas agrupadas pelo mês de vencimento do certificado digital. A seção terá navegação por mês (anterior/próximo) e abrirá no mês atual.

## Alterações em `src/pages/Clients.tsx`

### 1. Estado para o mês selecionado
Adicionar estado `certMonth` inicializado com `new Date()` (ano e mês atual).

### 2. Dados filtrados por mês
Usar `useMemo` para filtrar `clients` (apenas ativos com `digital_certificate_expiry`) cujo vencimento caia no mês selecionado. Ordenar por data de vencimento crescente.

### 3. Contadores auxiliares
Calcular no mesmo `useMemo`:
- Total de certificados vencendo no mês
- Quantos já estão vencidos (data < hoje)
- Quantos vencem nos próximos 15 dias

### 4. UI da seção
Inserir após os gráficos (linha ~1204) e antes do filtro de busca (linha ~1206):

```text
┌──────────────────────────────────────────────────────┐
│ 🔒 Vencimento de Certificados                       │
│  ◀  Abril 2026  ▶                                   │
│                                                      │
│  [Vencidos: 2]  [Próx. 15 dias: 3]  [Total: 8]     │
│                                                      │
│  Empresa          | CNPJ       | Vencimento | Status │
│  Acme Ltda        | 12.345...  | 05/04/2026 | 🔴    │
│  Beta Corp        | 98.765...  | 18/04/2026 | 🟡    │
│  ...              |            |            |        │
│                                                      │
│  (ou "Nenhum certificado vence neste mês")           │
└──────────────────────────────────────────────────────┘
```

- Header com botões `ChevronLeft`/`ChevronRight` para navegar entre meses
- Nome do mês em português + ano centralizado
- 3 mini-badges de resumo (vencidos, próximos 15 dias, total do mês)
- Tabela compacta: Empresa, CNPJ, Data de Vencimento, Status (badge colorido: vermelho=vencido, amarelo=≤30 dias, verde=>30 dias)
- Clique na linha abre o cadastro do cliente (reutiliza `openView`)
- Se não houver certificados no mês, mostra mensagem vazia

### 5. Ícone/import
Adicionar `ShieldAlert` ao import do lucide-react (já tem `ShieldCheck`).

## Arquivo
- `src/pages/Clients.tsx` — ~60 linhas adicionadas
