## Redesign da página E-mail — Layout Gmail (2 colunas)

Reestruturar `src/pages/Email.tsx` para replicar o layout do Gmail mostrado na referência:

### Layout

```
┌──────────────┬──────────────────────────────────────────────┐
│              │  ☐ ⟳ ⋮                       1–50 de N  ‹ ›  │
│  ✏ Escrever  ├──────────────────────────────────────────────┤
│              │  [Principal] [Promoções] [Social] [Updates]  │
│ 📥 Entrada N │──────────────────────────────────────────────│
│ ⭐ Estrela   │  ☐ ⭐ Remetente   Assunto — preview     hora │
│ 🕐 Adiados   │  ☐ ⭐ Remetente   Assunto — preview     hora │
│ ➤ Enviados   │  ...                                          │
│ 📄 Rascunhos │                                               │
│ ⌄ Mais       │                                               │
│              │                                               │
│ Marcadores + │                                               │
│  • Label 1   │                                               │
│  • Label 2   │                                               │
└──────────────┴──────────────────────────────────────────────┘
```

- **Coluna 1 (sidebar 256px)**: botão "Escrever" arredondado, lista de pastas com contadores, seção "Marcadores" com labels do Gmail
- **Coluna 2 (flex)**: barra de ações no topo (selecionar tudo, refresh, paginação), abas de categoria (Principal / Promoções / Social / Atualizações), lista de e-mails estilo Gmail (linha única: checkbox, estrela, remetente em negrito se não lido, assunto + snippet inline, anexos como chips PDF, horário à direita)

### Abrir e-mail

Ao clicar numa linha, o conteúdo do e-mail abre **substituindo a lista** (mesma coluna 2), com:
- Barra superior: voltar (←), arquivar, lixeira, marcar não lido, estrela
- Assunto grande + labels
- Cabeçalho do remetente (avatar inicial, nome, e-mail, data)
- Corpo HTML em iframe sandboxed
- Anexos como cards
- Botões Responder / Encaminhar no rodapé

A sidebar permanece visível. Não há coluna de leitura separada — é toggle lista ↔ leitor na coluna 2 (padrão Gmail mobile/atual).

### Componentes

- `src/pages/Email.tsx` — orquestra estado (folder, selectedId, category)
- `src/components/email/EmailSidebar.tsx` — sidebar com Escrever + pastas + marcadores
- `src/components/email/EmailListView.tsx` — toolbar + tabs + lista densa estilo Gmail
- `src/components/email/EmailRow.tsx` — linha única com snippet inline e chips de anexo
- `src/components/email/EmailReaderView.tsx` — visualização full-width do e-mail aberto
- `EmailCompose.tsx` — dialog reaproveitado

### Detalhes visuais

- Linha não lida: fundo branco, remetente/assunto em **bold**
- Linha lida: fundo `muted/30`, texto regular
- Hover: sombra sutil + ações revelam (arquivar/lixeira/marcar)
- Anexos: chip pill com ícone PDF + nome truncado
- Categorias (Principal/Promoções/Social/Atualizações): hardcoded por enquanto, baseado em labels do Gmail (`CATEGORY_PERSONAL`, `CATEGORY_PROMOTIONS`, `CATEGORY_SOCIAL`, `CATEGORY_UPDATES`)
- Marcadores do Gmail: ler `labels` dos `email_messages` e renderizar os user labels distintos

### Fora do escopo

- Sem mudanças de backend / edge functions / schema
- Sem threads
- Mantém realtime, compose, attachments existentes
