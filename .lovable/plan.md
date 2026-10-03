# Gerar DAS do MEI em lote

## O que muda
Na aba Fiscal > MEI > Guias e Pagamentos:

- Caixa de seleção em cada empresa e "selecionar todas" (vale para a lista filtrada, todas as páginas).
- Botão **"Gerar DAS em lote (N)"** ao lado de "Atualizar situação". Sem seleção, usa a lista atual filtrada (ex.: só "Em aberto").
- Empresas já pagas na competência ficam de fora por padrão (opção "Incluir pagas").
- Gera a guia da competência escolhida (mês/ano do topo), uma empresa por vez, com pausa curta.
- Janela de progresso ("12 de 55"), com botão Cancelar.
- No fim, baixa um único ZIP `DAS_MEI_AAAAMM.zip` com um PDF por empresa (`DAS_{codigo}_{empresa}.pdf`).
- Resumo final: quantas guias vieram e lista das que falharam com o motivo da Receita (ex.: sem procuração, sem CNPJ).
- Os botões individuais continuam iguais.

## Custo
Cada guia é uma chamada cobrada no contrato SERPRO. A janela mostra antes de começar quantas guias serão geradas, para confirmar.

## Detalhes técnicos
- `src/components/mei/MeiTab.tsx`: reaproveitar `run` + `walkForPdf(parseDeep(...))` com GERARDASPDF21 (`periodoApuracao` AAAAMM); converter base64 em bytes.
- Loop sequencial com 500 ms de pausa, 1 nova tentativa em erro, cancelamento via ref; pula empresas sem CNPJ.
- ZIP com `jszip` (já instalado).
- Sem mudanças no banco nem nas funções do servidor.
