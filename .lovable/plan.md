## Aumentar área de leitura do e-mail

No `MessageReader` (`src/pages/Email.tsx`), o corpo da mensagem (iframe) está apertado porque o header do e-mail (assunto, de/para, data, vincular cliente) ocupa muito espaço fixo e o iframe usa apenas o restante.

### Mudanças

1. **Compactar o header do leitor**
   - Reduzir padding (`px-4 py-3` → `px-6 py-2`)
   - Colocar metadados (De, Para, Data) em linha única menor; mover "Vincular cliente" para a toolbar superior
   - Assunto mantém destaque mas com menos margem

2. **Remover toolbar superior duplicada da página quando o e-mail está aberto**
   - Quando há `selected`, esconder a barra de busca/contador da página (`main > toolbar`) e deixar só a do `MessageReader` (que já tem voltar, estrela, marcar, arquivar, lixeira, responder, encaminhar)
   - Isso devolve ~50px de altura ao iframe

3. **Iframe ocupa todo o espaço restante**
   - Garantir `flex-1 min-h-0` no container do iframe e `h-full w-full` no iframe (já está, mas confirmar após compactação)
   - Aumentar largura: remover qualquer max-width; iframe usa 100% da coluna principal

4. **Anexos compactos**
   - Barra de anexos no rodapé com `py-1.5` em vez de `py-2`

Resultado: a área visível do corpo do e-mail ganha tipicamente 80-120px de altura e usa toda a largura da coluna principal.

### Arquivo

- `src/pages/Email.tsx` — apenas ajustes no componente `MessageReader` e na condicional da toolbar do `<main>`.
