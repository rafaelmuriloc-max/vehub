# Excluir botão "Nova empresa" da página Pessoal

## O que muda
- Em `src/pages/Personnel.tsx`, remove o botão **"Nova empresa"** (que hoje leva ao cadastro de cliente) da barra superior da página Pessoal, ao lado dos botões **Férias**, **Sincronizar** e **Funcionários**.

## O que permanece igual
- Os botões **Férias**, **Sincronizar** e **Funcionários** continuam como estão.
- O botão **Adicionar funcionário** dentro da expansão de cada empresa continua como está.
- O cadastro de novas empresas continua existindo na tela de Clientes — só o atalho some da Pessoal.
- Nada muda no banco de dados.

## Validação
- `bunx tsgo --noEmit` e build.
