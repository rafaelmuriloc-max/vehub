# Mover DCTFWeb para a página Pessoal

## O que muda
- O botão **DCTFWeb** sai da página Fiscal.
- Na página Pessoal surge o botão **DCTFWeb**, ao lado de "Férias" e "Folha". Ele abre a mesma tela de DCTFWeb de hoje, com competência, pagamentos, envio, guias e exportações.
- A tela de DCTFWeb ganha um botão "Voltar" que leva de volta para Pessoal.

## O que não muda
- Nenhuma função da tela de DCTFWeb muda, e os dados continuam os mesmos.

## Detalhes técnicos
- `src/pages/Fiscal.tsx`: remover o item `dctfweb`, o import de `DctfwebTab` e `FileCheck`.
- Nova página `src/pages/Dctfweb.tsx` (cabeçalho com voltar para `/personnel` + `<DctfwebTab />`), com a rota `/dctfweb` em `App.tsx`.
- `src/pages/Personnel.tsx`: botão outline com o ícone `FileCheck` que leva para `/dctfweb`, junto aos botões Férias/Folha.
