# DCTFWeb: listar só empresas com DARF Previdenciário concluído

## O que muda para você
- A lista da aba DCTFWeb passa a mostrar **apenas as empresas que têm a obrigação "Darf Previdenciário" concluída** no mês escolhido no topo.
- Ao trocar o mês ou o ano, a lista se atualiza.
- O contador no rodapé passa a mostrar "X empresas com DARF Previdenciário concluído".
- Se nenhuma empresa tiver a obrigação concluída no mês, aparece o aviso "Nenhuma empresa com DARF Previdenciário concluído neste mês".
- Os botões Recibo, Declaração e Guia continuam iguais para as empresas listadas.

## Ponto a confirmar
- O mês escolhido é comparado com o **mês de referência** da obrigação no Calendário. Hoje, setembro/2026 tem 71 concluídas e agosto/2026 tem 55. Se o mês de referência do Calendário for o do vencimento, e não o da competência, ajusto para usar o mês seguinte.

## Detalhes técnicos
- Em `src/components/dctfweb/DctfwebTab.tsx`, os clientes passam a vir de `obligation_instances` com `status='done'`, `deleted_at is null`, `reference_month = '{ano}-{mes}-01'` e a obrigação cujo nome é "Darf Previdenciário" (buscada por nome com `ilike '%darf previd%'`, sem id fixo), com join em `clients(id, company_name, sci_code, document, status)` filtrando os ativos. A lista é refeita quando `ano`/`mes` mudam e a página volta para a primeira.
- Categorias 13º/Anual usam `reference_month` de dezembro do ano escolhido.
- Sem mudança no banco nem nas funções do servidor.
