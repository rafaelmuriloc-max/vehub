# Menu próprio "Notas Fiscais" no portal do cliente

## O que muda para o cliente
- Novo item **Notas** no menu (barra de baixo no celular e abas no computador), entre Documentos e Pessoal.
- A tela Notas tem duas abas: **Emitidas** e **Recebidas**, com a mesma lista de hoje (tipo NF-e/NFC-e, número, emitente nas recebidas, data, valor, "Cancelada").
- No topo da tela: resumo com quantidade de notas e valor total (sem canceladas) da aba aberta, e busca por número ou emitente.
- A tela Documentos fica só com **Documentos** e **Guias DAS** (as notas saem de lá).
- O cartão "Faturamento do mês" no Dashboard passa a abrir a tela Notas.

## Celular
- A barra de baixo passa de 5 para 6 itens (Dashboard, Calendário, Documentos, Notas, Pessoal, Perfil), com textos menores para caber em telas estreitas.

## Detalhes técnicos
- `src/pages/Portal.tsx`: adicionar `'notas'` ao tipo de view e ao array `NAV` (ícone `Receipt`), novo ramo `view === 'notas'` com Tabs emitidas/recebidas, busca e resumo calculado com `useMemo`; remover as abas de notas de `documentos`; KPI de faturamento chama `setView('notas')`; nav inferior `grid-cols-6`, rótulo `text-[10px]`.
- Sem mudanças no banco ou na segurança — usa os mesmos dados já carregados.
