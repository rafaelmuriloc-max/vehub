# Melhorar a janela "Recalcular guia" e deixar responsiva no celular

## Problema visto
A prévia da guia aparece como "Este conteúdo está bloqueado": o navegador não deixa mostrar o PDF dentro da janela. Ela ocupa muito espaço e esconde a mensagem e os botões.

## O que será feito
- **Troca da prévia por um cartão da guia**: ícone de PDF, nome do arquivo, tipo (DAS ou DCTFWeb), competência, empresa e tamanho. Botão **Abrir guia** abre o PDF numa nova aba para conferir.
- **Layout mais organizado**:
  - Bloco 1 "Dados da guia": empresa, tipo, categoria (só DCTFWeb), mês e ano, com rótulos pequenos.
  - Bloco 2 (aparece depois de gerar): cartão da guia + mensagem para o cliente, com contador de caracteres.
  - Rodapé fixo com os botões, sempre visível, sem precisar rolar.
- **Celular**:
  - A janela ocupa a tela inteira, com rolagem só no meio e o rodapé fixo embaixo.
  - Campos empilhados um por linha; mês e ano lado a lado.
  - Botões em largura total, com "Enviar no chat" em destaque por cima de "Baixar" e "Gerar de novo".
  - Funciona também com o teclado aberto ao editar a mensagem.

## Detalhes técnicos
- Só `src/components/chat/RecalcGuiaDialog.tsx`.
- Remove o `iframe`; "Abrir guia" usa `window.open(blobUrl)`; tamanho via `file.size`.
- `DialogContent`: `flex flex-col p-0 max-h-[100dvh] h-[100dvh] sm:h-auto sm:max-h-[90dvh] w-full sm:max-w-xl rounded-none sm:rounded-lg`; corpo `flex-1 overflow-y-auto`; rodapé `border-t` fixo.
- Grade: `grid-cols-2` para mês/ano, demais `col-span-2`; no desktop tipo/categoria lado a lado.
- Apenas tokens de cor do tema.
