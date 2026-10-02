# Parcelamentos RFB: ocultar empresas sem parcelamento

## O que muda
- A lista passa a mostrar **somente empresas que têm pelo menos um parcelamento** encontrado na Receita.
- Empresas consultadas com resultado "Sem parcelamentos" deixam de aparecer na lista, em qualquer filtro.
- Empresas **ainda não consultadas** ou **com erro na consulta** também ficam fora da lista padrão. Elas só aparecem quando você clica nos cartões "Não consultadas" ou "Com erro na consulta" (ou escolhe essas situações no filtro). Assim ainda dá para consultá-las.
- A opção "Sem parcelamentos" sai do filtro de situação.
- Os cartões do topo, a busca, a paginação (15 por página) e os botões Atualizar, Gerar parcela e Enviar continuam iguais.

## Detalhes técnicos
- `src/components/integra-contador/RfbParcelamentos.tsx`: no `filtered`, quando a situação for "Todas" (ou ativo/encerrado/com), manter apenas itens com `parc.status === 'success'`; itens `no_data` sempre removidos; `sem` e `erro` continuam funcionando pelos filtros próprios.
- Remover o `SelectItem value="no_data"`.
- Sem mudanças no banco.
