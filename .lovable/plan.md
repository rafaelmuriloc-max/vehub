# Botão de voltar na tela Folha de pagamento

## O que muda
- No topo da tela Folha, antes do caminho "Departamento pessoal / Folha de pagamento", volta o botão com a seta para a esquerda.
- Ao clicar, ele leva para a página Pessoal, como fazia antes do novo visual.
- Ele tem a descrição "Voltar para Pessoal" para quem usa leitor de tela e pode ser acionado pelo teclado.

## Técnico
- Só muda `src/pages/Payroll.tsx`: volta o `useNavigate` e entra um `Button` ghost/icon com `ArrowLeft` (`navigate('/personnel')`), `aria-label="Voltar para Pessoal"`, ao lado do breadcrumb.
- Validação: `bunx tsgo --noEmit` e build.
