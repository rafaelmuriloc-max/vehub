# DCTFWeb: aproveitar as consultas já feitas

## Por que aparece "Não consultado"
A consulta anterior verificou só o pagamento, não o envio. Os 126 registros salvos (08/2026 e 09/2026) estão sem a informação "enviada", por isso aparecem como não consultados.

## O que muda
- Empresas com guia **paga** (26 em 08/2026 e 3 em 09/2026) passam a contar como **Enviadas**, porque só existe guia paga se a declaração foi transmitida. Isso vale para os registros salvos e também na tela.
- As outras empresas consultadas antes (em aberto ou vencidas) ganham o selo **"Envio não verificado"**, em vez de "Não consultado". Os botões Recibo, Declaração e Guia continuam disponíveis para elas, como era antes.
- Ao clicar em **Atualizar situação**, essas empresas passam a mostrar a situação definitiva: Enviada ou Não enviado.

## Detalhes técnicos
- Ajuste de dados: `update dctfweb_competencias set enviada=true where status='pago' and enviada is null`.
- `DctfwebTab.tsx`, em `envioOf`:
  - `enviada===true` ou `status==='pago'` → enviada.
  - `enviada===false` → não enviada.
  - Registro com `enviada` nulo → 'legado': selo "Envio não verificado", botões visíveis, conta como Enviada no cartão e no lote de guias.
  - Sem registro → não consultado.
