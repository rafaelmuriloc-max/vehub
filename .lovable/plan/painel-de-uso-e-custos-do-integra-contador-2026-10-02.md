# Painel de uso e custos do Integra Contador

## O que muda para você
- Nova aba **Custos SERPRO** na página Fiscal.
- No topo, o **ciclo de faturamento** do contrato (dia 21 do mês anterior ao dia 20 do mês atual), com opção de ver ciclos passados.
- Cartões: fatura estimada do ciclo, total de requisições cobradas (Consulta, Emissão, Declaração), custo médio por requisição, requisições com erro e **projeção da fatura** no dia 20 no ritmo atual.
- Para cada tipo, uma barra mostra a faixa de preço atual e quantas faltam para a próxima faixa mais barata.
- Gráficos: gasto e volume por dia, consumo por módulo (DCTFWeb, Simples, Pagamentos, MEI, Situação Fiscal, Parcelamentos) e ranking das empresas que mais consomem.
- Atualiza sozinho a cada nova chamada à Receita. Botão para exportar em planilha (CSV).
- Os números só começam a contar a partir da implantação; chamadas anteriores não ficaram registradas.

## Detalhes técnicos
- Migração: tabela `integra_contador_usage` (client_id, id_sistema, id_servico, tipo, status_http, sucesso, duracao_ms, created_at), GRANT select a authenticated + all a service_role, RLS leitura para authenticated, índice em created_at, realtime habilitado.
- `integra-contador/index.ts`: após cada resposta do gateway SERPRO, insere uma linha (sem aguardar, try/catch para não afetar a chamada). Respostas 304 (cache) marcadas como não cobradas.
- Preços em `src/lib/serproPricing.ts` com as faixas do Anexo I (progressivas por faixa acumulada no ciclo) e função de ciclo 21→20; testes unitários do cálculo.
- `src/components/integra-contador/UsageCostTab.tsx` com Recharts e canal realtime (com cleanup); `Fiscal.tsx` ganha o item `custos`.
- Faixas intermediárias não citadas no resumo do contrato serão conferidas no PDF antes de codificar.
