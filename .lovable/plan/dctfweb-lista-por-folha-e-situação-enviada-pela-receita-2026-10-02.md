# DCTFWeb: lista por folha e situação "Enviada" pela Receita

## O que muda para você
- A lista passa a ter **todas as empresas ativas com a obrigação "Folha de Pagamento Mensal" ou "Folha Pró-labore"**, e não só as que têm o DARF Previdenciário concluído.
- Cada empresa mostra se a DCTFWeb do mês foi **Enviada** ou **Não enviada**. Essa informação vem da Receita, não do calendário.
  - **Enviada**: aparecem os botões Recibo, Declaração e Guia, e o selo Pago, Em aberto ou Vencida.
  - **Não enviada**: aparece só o selo "Não enviado", sem botões.
  - **Ainda não consultada**: aparece o selo "Não consultado" e o ícone para consultar.
- O botão **Atualizar situação** consulta, uma empresa por vez, se a declaração foi enviada. Para as enviadas, também consulta se a guia foi paga. Dá para acompanhar o andamento e cancelar.
- Cartões no topo: total de empresas, enviadas, não enviadas, pagas e em aberto. Clicar num cartão filtra a lista.
- Filtro rápido: Todas, Enviadas, Não enviadas, Pagas e Em aberto.
- **Baixar todas as guias** só inclui as empresas enviadas.
- O resultado fica guardado, então não é preciso consultar a Receita toda vez que você abre a tela.

## Como saber se foi enviada
- O sistema pede à Receita o recibo de entrega da DCTFWeb do mês. Se o recibo vier, a declaração foi **enviada**.
- Se a Receita disser que não há declaração para o período, fica como **não enviada**.
- Outros erros, como falta de procuração, aparecem como "Aviso da Receita" com o motivo. Nesses casos a situação continua sem conclusão.

## Detalhes técnicos
- Migração: em `dctfweb_competencias`, adicionar `enviada boolean` (aceita vazio), `enviada_em timestamptz` e `consultado_em timestamptz`.
- `dctfweb-pagamentos` recebe o modo `check_envio`. Primeiro chama `integra-contador` com DCTFWEB/CONSRECIBO32 (Consultar). Com PDF ou resposta de sucesso, grava `enviada=true`. Com mensagem de "não encontrada" ou "inexistente", grava `enviada=false`. Com outro erro, grava `mensagem` e deixa `enviada` vazio. Quando `enviada=true`, segue para a consulta de pagamentos que já existe. O upsert continua igual.
- `DctfwebTab.tsx`: o universo vem de `obligations` com `ilike` em "folha de pagamento mensal" ou "folha pr%labore". Depois busca `client_department_obligations` com essas obrigações e cruza com `clients` ativos. Se esse vínculo não trouxer dados, usa `obligation_instances` da competência como alternativa. Os estados, os cartões, o filtro e o lote seguem o padrão atual, e o lote de guias filtra `enviada===true`.
- O texto exato da mensagem de "não encontrada" será confirmado no log da primeira consulta real.
