# Nome sempre exibido na coluna Destinatário/Emitente (NFS-e)

## Objetivo
A coluna Destinatário (Prestados) e Emitente (Tomados) deve sempre mostrar o nome, nunca `—`. Hoje a resolução depende apenas do CNPJ estar cadastrado em `clients` ou `service_takers`; quando não está cadastrado, aparece `—`.

## Diagnóstico
Em `src/components/invoices/NfseTab.tsx`, `getCounterpartyName` (linhas 570-574) busca o nome somente em `cnpjNameMap` (cadastros internos). O próprio XML da nota (campo `raw_data.xml`) já contém a razão social do emitente (`Emit > xNome`) e do tomador (`Toma > xNome` / `Dest > xNome`), então o nome pode ser extraído diretamente da nota.

## Alteração
Em `getCounterpartyName` (NfseTab.tsx):
1. Primeiro tenta o cadastro interno (`cnpjNameMap`) — como hoje.
2. Se não achar, extrai a razão social do XML em `raw_data.xml`:
   - Prestados: bloco do tomador/destinatário (`<Toma>`, `<Tomador>`, `<Dest>` ou `<Destinatario>` → `<xNome>`).
   - Tomados: bloco do emitente/prestador (`<Emit>`, `<Prestador>` → `<xNome>`).
   - Extração via regex simples sobre o XML (sem parser pesado), com fallback entre variações de tags usadas pelos padrões NFS-e municipais.
3. Último fallback permanece `—` apenas se a nota não tiver XML.

## Verificação
- Typecheck/build.
- Conferir nas duas abas que linhas antes com `—` agora exibem a razão social do XML.
