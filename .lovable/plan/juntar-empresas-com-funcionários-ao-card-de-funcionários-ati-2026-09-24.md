# Juntar "Empresas com funcionários" ao card de Funcionários ativos

## O que muda

Na página Pessoal, o número de empresas com funcionários passa a aparecer dentro do card **Funcionários ativos**, em vez de ser um card separado.

- Card "Funcionários ativos" fica com duas linhas de apoio:
  1. quantidade de desligados (como já é hoje);
  2. "X empresa(s) com funcionários" — o número que hoje tem card próprio, com ícone de prédio.
- O card separado "Empresas com funcionários" é removido.
- A grade de cards passa de 5 para 4 cards (mesma largura e estilo atuais, sem mudanças de layout).

## Regras preservadas

- Nenhum número muda de valor: só de posição.
- Empresas inativas continuam de fora das contas (regra já vigente).
- Os demais cards (Total de salários, Experiências a vencer, Férias a vencer) e todos os fluxos da página ficam como estão.

## Arquivos

- `src/pages/Personnel.tsx` — apenas o bloco dos cards de indicadores.

## Validação

- `bunx tsgo --noEmit` + build.
