# Layout da página de Notas Fiscais conforme imagem de referência

## Objetivo
Deixar o cabeçalho, as abas e o card de consulta da página de Notas Fiscais iguais ao layout da imagem anexada.

## Mudanças

### 1. Cabeçalho da página (`src/pages/Invoices.tsx`)
- Ícone em tile quadrado arredondado com borda laranja (FileText + cifrão) ao lado do título "Notas Fiscais".
- Subtítulo "Consulta e gestão de documentos fiscais eletrônicos" abaixo do título.

### 2. Abas NFS-e / NF-e / NFC-e (`src/pages/Invoices.tsx`)
- Estilo de abas sublinhadas (igual ao padrão de relatório já usado nas obrigações): aba ativa com texto laranja e underline laranja, inativas em cinza.
- Linha das abas com o botão laranja "Emitir NFS-e" alinhado à direita (visível apenas na aba NFS-e e para admin). O botão sai de dentro do `NfseTab` e passa a ser renderizado via prop/callback no cabeçalho das abas.

### 3. Card "Consultar Notas no Portal Nacional" (`src/components/invoices/NfseTab.tsx`)
- Título com ícone de busca dentro de tile quadrado arredondado, seguido de divisor horizontal.
- Campos em linha: Cliente (select "Todos os clientes"), Mês de Referência (input month com ícone de calendário) e botão laranja "Buscar Notas" com ícone de lupa, alinhado à direita.
- Remover a linha superior isolada que hoje contém apenas o botão "Emitir NFS-e" (ele sobe para a linha das abas).

### 4. NF-e e NFC-e
- Manter conteúdo atual; apenas o estilo das abas muda (compartilhado).

## Detalhes técnicos
- Abas sublinhadas: `TabsList` com `bg-transparent`, triggers com `rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary`.
- Cores via tokens semânticos (`primary` laranja já existente); sem classes hardcoded.
- Nenhuma mudança de lógica: filtros, sync, cache e paginação permanecem.
- Responsivo: em mobile, botão "Emitir NFS-e" vai para baixo das abas (flex-col).
