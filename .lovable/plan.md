# Botão Sincronizar único com menu expansível na página Pessoal

## O que muda
Hoje a página Pessoal tem três botões lado a lado: **Sincronizar pasta**, **Sincronizar experiência** e **Sincronizar férias**. Passa a haver **um único botão "Sincronizar"** que, ao clicar, expande abaixo dele a lista das três opções.

## Como funciona
- Um botão principal "Sincronizar" (estilo padrão do sistema, com ícone) no lugar dos três.
- Ao clicar, abre um menu suspenso logo abaixo com as três opções atuais, cada uma com seu ícone:
  - Pasta (fichas de registro)
  - Experiência (contrato de experiência)
  - Férias (vencimento de férias)
- Ao escolher uma opção, o menu fecha e a sincronização correspondente começa normalmente (com o indicador de carregamento de sempre).
- Enquanto alguma sincronização estiver em andamento, o botão principal fica desabilitado, como já acontece hoje.
- O botão "Definir pasta" (admin) fica fora do menu, como está.

## Arquivo alterado
- `src/pages/Personnel.tsx` — substitui os três botões por um menu suspenso (padrão de menu já usado no sistema) com os três itens. Nenhuma lógica de sincronização é alterada.

## Validação
- `bunx tsgo --noEmit` e build.
