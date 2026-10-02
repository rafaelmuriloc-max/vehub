# Baixar todas as guias DCTFWeb em lote

## O que muda
Na aba Fiscal → DCTFWeb, um botão **"Baixar todas as guias (N)"** no topo, ao lado dos filtros.

- Usa a lista atual (empresas com DARF Previdenciário concluído na competência, respeitando a busca digitada), todas as páginas.
- Gera a guia de uma empresa por vez, com pequena pausa, para não sobrecarregar a Receita.
- Mostra progresso ("12 de 55") e pode ser cancelado.
- No fim, baixa um único arquivo ZIP `DCTFWeb_Guias_AAAAMM.zip` com um PDF por empresa.
- Resumo final: quantas guias vieram e lista das empresas que falharam com o motivo da Receita (ex.: falta de procuração).
- Os botões individuais continuam iguais.

## Detalhes técnicos
- `src/components/dctfweb/DctfwebTab.tsx`: extrair a chamada `integra-contador` (GERARGUIA31/Emitir) e a extração do PDF base64 para uma função reutilizável que retorna bytes em vez de abrir a aba.
- Loop sequencial com 500 ms de pausa, 1 nova tentativa em erro de rede, flag de cancelamento via ref.
- ZIP com `jszip` (adicionar dependência se não existir); nome do PDF `Guia_{sci_code}_{empresa_sanitizada}.pdf`.
- Diálogo de progresso com barra e lista de falhas.
- Sem mudanças no banco nem nas funções do servidor.
