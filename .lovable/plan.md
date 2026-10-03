# Ícones dos documentos iguais ao modelo

Em "Documentos Recentes" e na aba Documentos do portal, o quadrado colorido com o tipo do arquivo vira um ícone em forma de folha, como no modelo:

- Folha com o canto superior direito dobrado, em um tom mais claro.
- O tipo do arquivo aparece em branco e negrito no centro da folha.
- Cores por tipo:
  - **PDF:** vermelho
  - **XLS, XLSX e CSV:** verde (aparece como "XLS")
  - **DOC e DOCX:** azul (aparece como "DOC")
  - **XML:** laranja
  - **Outros tipos:** cinza
- Tamanho: cerca de 40 × 48 px, alinhado ao nome e à linha "Área • competência".

## Technical details
- Novo `FileTypeIcon` em `src/components/portal/PortalWidgets.tsx`, feito em SVG inline:
  - Corpo: path com cantos arredondados e `fill` no token da cor do tipo (`hsl(var(--tag-*))`).
  - Dobra: triângulo no canto superior direito com `fill-opacity` de cerca de 0,35 em branco.
  - Rótulo: texto em `primary-foreground`.
- Mapeamento por extensão: `pdf`→`tag-inss`, `xls/xlsx/csv`→`tag-fgts`, `doc/docx`→`tag-das`, `xml`→`tag-iss`, demais→`tag-outro`.
- Substituir o `<span>` atual do ícone em `RecentDocuments` por esse componente.
