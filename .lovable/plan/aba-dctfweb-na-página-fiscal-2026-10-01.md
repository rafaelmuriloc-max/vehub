# Aba DCTFWeb na página Fiscal

## O que muda para você
- Na página Fiscal surge o botão **DCTFWeb**, ao lado de "Simples Nacional".
- No topo da aba você escolhe a **competência** (mês e ano, já vem o mês anterior) e a **categoria** (Geral Mensal, já marcada; 13º Salário e Geral Anual também podem ser escolhidas).
- Logo abaixo fica a lista das empresas ativas, com busca por nome, código SCI ou CNPJ e 15 empresas por página.
- Cada empresa tem três botões:
  - **Recibo**: baixa o recibo de entrega da DCTFWeb do mês.
  - **Declaração**: baixa a declaração completa.
  - **Guia**: gera o DARF da DCTFWeb para pagamento.
- O PDF abre em nova aba e também é baixado (ex.: `DCTFWeb_Guia_202609_EMPRESA.pdf`).
- Enquanto a Receita responde, o botão gira e os outros botões da mesma linha ficam travados.
- Se a Receita recusar (por exemplo, declaração não transmitida ou falta de procuração), a mensagem dela aparece na tela.

## O que não muda
- Nada é guardado no banco e nenhuma declaração é transmitida. A aba só consulta a Receita e gera documentos.

## Detalhes técnicos
- Novo `src/components/dctfweb/DctfwebTab.tsx`; `src/pages/Fiscal.tsx` ganha o item `dctfweb` (ícone `FileCheck`).
- Clientes: `clients` com `status='active'`, ordenados por nome, busca local, paginação de 15 itens.
- Chamadas via `supabase.functions.invoke('integra-contador', { body: { client_id, idSistema: 'DCTFWEB', idServico, tipo, dados } })` com `dados = JSON.stringify({ categoria, anoPA, mesPA })`:
  - Recibo: `CONSRECIBO32` (Consultar)
  - Declaração: `CONSDECCOMPLETA33` (Consultar)
  - Guia: `GERARGUIA31` (Emitir)
- O PDF é extraído com a mesma lógica de `CompetenciaRow` (busca recursiva por base64 `JVBER…`) e aberto via Blob. Os erros vêm de `data.mensagens[].texto`.
- Sem migração e sem mudança nas funções do servidor.
