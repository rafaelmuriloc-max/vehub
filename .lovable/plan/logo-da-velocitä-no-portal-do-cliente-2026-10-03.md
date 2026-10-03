# Logo da Velocitä no portal do cliente

A logo enviada (seta laranja sobre fundo azul-marinho) passa a aparecer no topo do portal do cliente, no lugar do quadrado azul com a letra "V".

- **Tamanho:** igual ao do quadrado atual, com cantos arredondados, no celular e no computador.
- **Texto ao lado:** continua "Velocitä · Portal do Cliente".
- **Ícone da aba do navegador:** passa a ser essa mesma logo, em todo o sistema.

## Technical details
- Subir a imagem com `lovable-assets` e salvar o ponteiro em `src/assets/logo_velocita.jpeg.asset.json`.
- Em `src/pages/Portal.tsx`, trocar o `<span>` do "V" por `<img src={logo.url} alt="Velocitä" className="h-9 w-9 rounded-xl object-cover shrink-0">`.
- Favicon: gerar `public/favicon.png` em 64x64 com `magick`, apontar o `<link rel="icon">` do `index.html` para ele e remover `public/favicon.ico`.
