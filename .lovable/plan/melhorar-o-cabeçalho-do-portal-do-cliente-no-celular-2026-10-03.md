# Melhorar o cabeçalho do Portal do Cliente no celular

## Problema visto
No celular, o ícone do prédio fica flutuando acima do seletor e o CNPJ escapa para fora da caixa da empresa. O logo, o seletor, o sino e as iniciais disputam a mesma linha.

## Como fica no celular
- **Linha 1**: logo "V" + "Velocitä · Portal do Cliente" à esquerda; sino (com contador) e iniciais à direita, em tamanho menor (40px).
- **Linha 2**: seletor da empresa em largura total, com o ícone do prédio à esquerda e o nome e o CNPJ empilhados dentro da caixa. O nome longo é cortado com "…" e a seta fica à direita.
- Fundo branco com sombra suave ao rolar. O espaço do entalhe do iPhone é respeitado.
- Com uma só empresa, a caixa vira um cartão fixo, sem seta.

## No computador
Mantém tudo em uma linha, como hoje, com o mesmo seletor corrigido.

## Detalhes técnicos
- Só `src/pages/Portal.tsx` (bloco `<header>`).
- O `SelectTrigger` padrão aplica `[&>span]:line-clamp-1`, o que quebra o layout interno. Sobrescrever com `[&>span]:line-clamp-none` e usar `items-center` e `h-14`.
- Estrutura `flex flex-col md:flex-row`: a linha 1 tem `justify-between`, e o seletor recebe `w-full md:max-w-sm`.
- Apenas tokens existentes (`portal-*`, `card`, `border`).
- Verificação com Playwright em 375px.
