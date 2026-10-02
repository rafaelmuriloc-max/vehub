# Baixar XML das NFC-e em lote

## O que muda
Na aba Notas Fiscais → NFC-e, um botão **"Baixar XMLs (N)"** ao lado de Sincronizar.

- Baixa os XMLs de todos os cupons da lista atual (empresa, período e filtros escolhidos), não só da página visível.
- Janela com progresso ("320 de 1.250") e opção de cancelar.
- No fim, baixa um único ZIP `NFCe_{empresa}_{periodo}.zip`, com os XMLs separados em pastas por empresa quando houver mais de uma.
- Cupons sem XML guardado aparecem num resumo final (quantidade e chaves).
- O botão de download individual continua igual.

## Detalhes técnicos
- `src/components/invoices/NfceTab.tsx`: reaproveitar a lógica de `handleDownloadXml` (Storage `documents/xml_url`, depois `raw_xml`) numa função que retorna o texto.
- Downloads do Storage em paralelo limitado (8 por vez); os que não têm `xml_url` buscam `raw_xml` em blocos de 200 ids por consulta.
- ZIP com `jszip` (já instalado), nome do arquivo `{chave}.xml`.
- Diálogo com `Progress`, cancelamento por ref.
- Sem mudanças no banco nem nas funções do servidor.
