# Botão Sincronizar só com o ícone, ao lado da Competência

## O que muda
- O botão laranja **Sincronizar** sai do canto direito do topo e passa a ficar logo depois do campo do mês (Competência), na mesma linha dos filtros.
- Ele mostra só o ícone de setas girando, sem o texto. Ao passar o mouse aparece a dica "Sincronizar folha".
- Continua laranja e com a mesma sincronização de hoje. Enquanto roda, o ícone gira, o botão fica travado e o aviso de sucesso ou erro aparece no fim, como hoje.

## Técnico
- Só muda `src/pages/Payroll.tsx`: o `Button` sai do bloco do título e vai para depois do Popover de competência, `size="icon"`, com `aria-label` e `title` "Sincronizar folha" e `aria-busy` durante a sincronização.
- Validação: `bunx tsgo --noEmit` e build.
