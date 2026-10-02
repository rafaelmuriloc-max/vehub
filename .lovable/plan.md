# Guias DCTFWeb pagas e em aberto

## O que muda para você
- No topo da aba Fiscal → DCTFWeb entram 4 cartões: empresas com guia no mês, guias pagas (com valor pago), guias em aberto/vencidas e percentual pago.
- Filtro rápido: Todas, Pagas ou Em aberto. Clicar num cartão aplica o filtro.
- Cada empresa mostra um selo: verde "Pago em DD/MM/AAAA" com o valor, ou âmbar "Em aberto" / vermelho "Vencida" (depois do dia 20 do mês seguinte).
- Botão **Atualizar situação** (todas as empresas da lista, uma por vez, com progresso e cancelar) e um ícone por empresa para atualizar só ela.
- A situação fica guardada: ao abrir a tela não é preciso consultar a Receita de novo.
- Empresas cuja procuração não inclui o serviço de pagamentos aparecem com aviso e continuam "Em aberto".

## Regras
- Pago = existe DARF arrecadado com o período de apuração da competência escolhida e código de receita da DCTFWeb (DARF numerado, receita 5041 e afins).
- Sem pagamento e antes do vencimento: Em aberto. Depois: Vencida.

## Detalhes técnicos
- Migração: tabela `dctfweb_competencias` (client_id, competencia date, categoria, status pago/aberto/vencido, valor_pago, data_pagamento, mensagem, timestamps), unique(client_id, competencia, categoria), GRANT a authenticated/service_role, RLS para usuários autenticados (mesmo padrão de `simples_nacional_competencias`), trigger de updated_at.
- Nova edge function `dctfweb-pagamentos`: recebe `client_id`, `ano`, `mes`, `categoria`; chama `integra-contador` com PAGTOWEB/PAGAMENTOS71 (mesma chamada já usada em `simples-nacional-sync`), filtra por período de apuração e códigos de receita da DCTFWeb, grava o resultado e devolve. O formato da resposta será conferido no primeiro retorno real pelo log.
- `DctfwebTab.tsx`: carrega `dctfweb_competencias` da competência, calcula cartões com `useMemo`, filtro `statusFilter`, selos por linha, atualização em lote no mesmo padrão do `runBulk` (sequencial, pausa 500ms, retry de rede).
- Cores por tokens do tema.
