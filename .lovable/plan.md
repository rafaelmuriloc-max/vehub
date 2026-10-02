# Botão "Recalcular guia" dentro da conversa do Chat

## O que será feito
- No topo da conversa, ao lado de "Solicitar tarefa", entra o botão **Recalcular guia** (só aparece quando a conversa tem empresa vinculada).
- Ao clicar, abre uma janela com:
  - **Empresa**: já vem a empresa da conversa; se houver mais de uma, dá para escolher (com busca).
  - **Tipo de guia**: Simples Nacional (DAS) ou DCTFWeb (DARF previdenciário).
  - **Competência**: mês e ano (vem marcado o mês anterior). Na DCTFWeb também o tipo: Geral Mensal, 13º ou Anual.
- Botão **Gerar guia**: a Receita emite a guia já atualizada com juros e multa até hoje.
- A guia aparece como prévia na janela, com duas opções: **Enviar no chat** (vai como PDF para o cliente, igual a um anexo) ou **Baixar**.
- Se a Receita recusar (sem declaração, sem procuração etc.), aparece o motivo dado por ela.

## O que não muda
- Nenhuma declaração é enviada; só a guia é emitida.
- As abas Simples Nacional e DCTFWeb da página Fiscal continuam iguais.

## Detalhes técnicos
- Novo `src/components/chat/RecalcGuiaDialog.tsx`.
- Chamadas via `supabase.functions.invoke('integra-contador')`:
  - Simples: `PGDASD / GERARDAS12`, tipo Emitir, `dados = { periodoApuracao: 'AAAAMM' }`.
  - DCTFWeb: `DCTFWEB / GERARGUIA31`, tipo Emitir, `dados = { categoria, anoPA, mesPA }`.
- Extração do PDF reaproveitando a busca recursiva por base64 `JVBERi0` (mesma de `CompetenciaRow`/`DctfwebTab`).
- Envio: converte o PDF em `File` (`Guia_DAS_202609_EMPRESA.pdf` / `Guia_DCTFWeb_...`) e usa o `onSendMedia(file, 'document')` já existente.
- `MessageArea.tsx`: nova prop `onRecalcGuia`, botão no cabeçalho (ícone `Calculator`), oculto em conversa fechada.
- `Chat.tsx`: estado de abertura da janela; passa os clientes vinculados à conversa (`clientId` + empresas do mapa de WhatsApp).
- Sem migração e sem mudança nas funções do servidor.
