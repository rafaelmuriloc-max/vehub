

# Visualização de Caixa Postal como Email Inbox

## Objetivo
Substituir a exibição JSON bruta dos resultados do Caixa Postal por uma interface visual de caixa de email: lista de mensagens em formato tabela clicável, e ao clicar, abrir os detalhes da mensagem em um Dialog.

## Mudanças

### Arquivo: `src/pages/IntegraContador.tsx`

1. **Detectar resposta do Caixa Postal**: Quando `selectedService?.idSistema === 'CAIXAPOSTAL'` e o resultado contém dados, parsear `result.dados` e renderizar visualmente ao invés do JSON bruto.

2. **Lista de mensagens (MSGCONTRIBUINTE61)**: Renderizar como tabela estilo inbox com colunas baseadas na imagem de referência:
   - Lida (ícone check)
   - Remetente
   - Assunto
   - Data de envio
   - Data de Leitura
   - Consultado em
   - Ação (ícones)
   
   Cada linha é clicável — ao clicar, chama automaticamente o serviço `MSGDETALHAMENTO62` com o ISN da mensagem para buscar detalhes.

3. **Detalhes da mensagem**: Exibir em um `Dialog` com layout de email (remetente, assunto, data, corpo da mensagem formatado).

4. **Fallback**: Para outros serviços e respostas não-Caixa Postal, manter o JSON bruto existente com um Accordion "Ver JSON completo" para referência.

### Detalhes técnicos

- Adicionar state `selectedMessage` e `messageLoading` para controlar a abertura do dialog e o carregamento dos detalhes.
- Parsear `result.dados` (string JSON) para extrair array de mensagens.
- Ao clicar numa mensagem, invocar `supabase.functions.invoke('integra-contador')` com `MSGDETALHAMENTO62` e o ISN.
- Usar `Dialog` para exibir o detalhamento, `Table` para a lista, `Badge` para status de leitura.
- Imports adicionais: `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` e `Dialog` components.

```text
┌────────────────────────────────────────────────┐
│ Resultado - Caixa Postal                       │
├──┬──────────┬──────────────┬────────┬──────────┤
│✓ │Remetente │ Assunto      │ Envio  │ Leitura  │
├──┼──────────┼──────────────┼────────┼──────────┤
│✓ │RFB       │ OMISSOS PJ.. │25/11  │ 26/11    │  ← clicável
│✓ │RFB       │ Termo de...  │10/06  │ 09/01    │
└──┴──────────┴──────────────┴────────┴──────────┘

         ↓ Click abre Dialog ↓

┌─────────────────────────────────┐
│ ✉ Detalhes da Mensagem          │
│ De: RECEITA FEDERAL DO BRASIL   │
│ Assunto: OMISSOS PJ: Termo...  │
│ Data: 25/11/2025                │
│─────────────────────────────────│
│ [Corpo da mensagem formatado]   │
│                                 │
│ ▶ Ver JSON completo (accordion) │
└─────────────────────────────────┘
```

