# Layout da aba NFS-e igual à imagem de referência

## Objetivo

Refazer os blocos de resumo "Serviços Prestados" e "Serviços Tomados" em `src/components/invoices/NfseTab.tsx` para ficarem no mesmo visual da imagem anexada: cada seção vira um painel em cartão com identidade por cor (azul = prestados, laranja = tomados) e hierarquia em três linhas.

## Estrutura de cada seção (conforme a imagem)

```text
┌─ Card painel (borda esquerda grossa na cor da seção) ─────────────┐
│ [ícone prédio em círculo] Serviços Prestados                      │
│ ┌────────────┐ ┌────────────────┐ ┌────────────────┐              │
│ │ [ícone]    │ │ [ícone]        │ │ [ícone]        │              │
│ │ Total de   │ │ Valor Bruto    │ │ Total de       │              │
│ │ Notas 6566 │ │ Total R$ ...   │ │ Impostos R$... │              │
│ └────────────┘ └────────────────┘ └────────────────┘              │
│ ┌─ Faixa "Impostos Retidos" (fundo azul/laranja claro) ─────────┐ │
│ │ [escudo] Impostos Retidos | Total Retido  R$ 466.979,43       │ │
│ └───────────────────────────────────────────────────────────────┘ │
│ [ISS] [IRRF] [PIS] [COFINS] [CSLL] [INSS] [CP]  (7 cards)         │
└───────────────────────────────────────────────────────────────────┘
```

## Mudanças

1. **Painel por seção**: envolver cada seção em um `Card` com `border-l-4` azul (`border-l-blue-500`) ou laranja (`border-l-orange-500`), fundo sutilmente tingido e cabeçalho com ícone `Building2` dentro de círculo colorido + título em negrito ("Serviços Prestados" / "Serviços Tomados").
2. **Cards de totais**: os 3 cards (Total de Notas, Valor Bruto Total, Total de Impostos) ganham um círculo de ícone colorido à esquerda (azul claro / laranja claro de fundo): `FileText` para notas, `DollarSign`/`Wallet` para valor bruto, `Landmark` para impostos. Valores em destaque como hoje.
3. **Faixa de Impostos Retidos**: substituir o card "Total Retido" por uma faixa horizontal de largura total com fundo azul/laranja bem claro (`bg-blue-50`/`bg-orange-50`, variantes dark), ícone `ShieldCheck` em círculo sólido, rótulo "Impostos Retidos", separador vertical e "Total Retido R$ ..." em negrito na cor da seção. Continua clicável (abre o detalhe `taxKey: 'total'`).
4. **Cards dos 7 impostos**: manter a grade de 7 (ISS, IRRF, PIS, COFINS, CSLL, INSS, CP), cada um com um ícone colorido pequeno acima do rótulo (ex.: `User`, `FileText`, `Coins`, `PieChart`, `Briefcase`, `Heart`, `Building`), mantendo o clique que abre o detalhamento por imposto.
5. **Comportamento preservado**: filtros, `showPrestadosRetentions`/`showTomadosRetentions`, dialog de detalhe de retenção e toda a tabela de notas permanecem iguais — é mudança apenas visual nos blocos de resumo.
6. **Mobile**: cards de totais empilham (1 coluna), impostos em 2 colunas.

## Detalhes técnicos

- Arquivo: `src/components/invoices/NfseTab.tsx`, blocos das linhas ~473-569 (Serviços Prestados / Serviços Tomados).
- Como os dois blocos são quase idênticos, extrair um subcomponente interno `ServiceSummarySection({ variant: 'blue' | 'orange', ... })` no próprio arquivo para evitar duplicação.
- Ícones do `lucide-react` já disponível. Cores azul/laranja já são o padrão atual da tela (consistente com a imagem).
- Sem mudanças de banco, queries ou edge functions.
