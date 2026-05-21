## Aba Parcelamentos no menu Fiscal

Adicionar uma nova aba "Parcelamentos" ao lado de Situação Fiscal / Notas Fiscais / Integra Contador, listando todas as empresas e os parcelamentos ativos consultados via Integra Contador (SERPRO).

### Comportamento da UI

- Botão "Parcelamentos" em `src/pages/Fiscal.tsx` (ícone `FileStack` ou `Wallet`).
- Novo componente `src/components/integra-contador/ParcelamentosTab.tsx` espelhando o padrão de `SituacaoFiscalTab.tsx`.
- Tabela com colunas: Empresa, CNPJ, Modalidade, Nº Parcelamento, Situação, Data do Pedido, Valor Total, Parcelas Pagas/Totais, Última Consulta, Ações (Ver detalhes).
- Filtros: busca por nome/CNPJ, filtro por Modalidade (PARCSN, PARCMEI, PERTSN, PERTMEI, RELPSN, RELPMEI, etc.), filtro por situação (Em parcelamento / Encerrado / Sem parcelamento / Erro).
- Seleção múltipla + botões "Consultar selecionados" e "Consultar todos" com barra de progresso (igual SITFIS).
- Botão "Consultar" individual por linha.
- Dialog "Ver detalhes" mostra o JSON formatado retornado pelo `PEDIDOSPARC` + lista de parcelamentos detectados.
- Considera apenas clientes ativos com `digital_certificate_url` (necessário para Integra Contador).

### Lógica de consulta

Para cada cliente, chamar a edge function `integra-contador` com os 8 serviços `PEDIDOSPARC` (um por modalidade):

| Modalidade | idSistema | idServico |
|---|---|---|
| Ordinário SN | PARCSN | PEDIDOSPARC163 |
| Especial SN | PARCSN-ESP | PEDIDOSPARC173 |
| PERT-SN | PERTSN | PEDIDOSPARC183 |
| RELP-SN | RELPSN | PEDIDOSPARC193 |
| Ordinário MEI | PARCMEI | PEDIDOSPARC203 |
| Especial MEI | PARCMEI-ESP | PEDIDOSPARC213 |
| PERT-MEI | PERTMEI | PEDIDOSPARC223 |
| RELP-MEI | RELPMEI | PEDIDOSPARC233 |

Respostas vazias = "sem parcelamento". Respostas com lista de parcelamentos são gravadas como uma linha por parcelamento.

### Banco de dados (migração)

Nova tabela `parcelamento_results`:

```text
id uuid PK
client_id uuid (referência clients.id)
modalidade text          -- PARCSN, PARCMEI, etc.
modalidade_label text    -- "Ordinário SN" etc.
numero_parcelamento text -- da resposta
situacao text            -- "Em parcelamento", "Encerrado", etc.
data_pedido date
valor_total numeric
parcelas_pagas integer
parcelas_total integer
raw_response jsonb       -- resposta completa do PEDIDOSPARC
status text              -- 'success' | 'no_data' | 'error'
error_message text
consulted_at timestamptz
created_at timestamptz
```

RLS: apenas admins gerenciam (`ALL`) e admins visualizam (`SELECT`) — mesmo padrão de `sitfis_results`.

Índices: `(client_id, modalidade)`, `(client_id)`.

### Edge function

Reaproveitar a existente `integra-contador` chamando `tipo: 'Consultar'`. O frontend itera as 8 modalidades, faz parse da resposta (`data.dados` é string JSON com array de parcelamentos) e dá `upsert` em `parcelamento_results` por `(client_id, modalidade, numero_parcelamento)`.

### Fora de escopo

- Emissão de DAS de parcela (já existe na página Integra Contador genérica).
- Detalhes de pagamento por parcela (DETPAGTOPARC) — somente botão "Ver no Integra Contador" levando para a página existente, se necessário no futuro.
- Agendamento automático (CRON) — consulta apenas sob demanda nesta versão.
