# Notas de serviço (NFS-e) na tela Notas do portal do cliente

## O que muda para o cliente
- A aba **Emitidas** mostra também as NFS-e que a empresa emitiu (serviços prestados).
- A aba **Recebidas** mostra também as NFS-e de serviços que a empresa contratou (serviços tomados), com o nome ou CNPJ de quem prestou.
- Cada nota tem uma etiqueta com o tipo: NF-e, NFC-e ou **NFS-e**.
- O seletor de período, a busca, a quantidade e o valor total passam a contar as NFS-e também (valor bruto da nota; canceladas ficam de fora).
- Um filtro de tipo (Todas / Produtos / Serviços) ajuda a separar as notas.

## Segurança
- Hoje as notas de serviço ficam totalmente fechadas para clientes. A liberação será só de leitura e só das empresas em que o e-mail do cliente é contato, pelo mesmo controle já usado nas NF-e. A equipe não é afetada.

## Detalhes técnicos
- Migração: nova RPC security-definer `portal_nfse(_client_id uuid, _from date, _to date)` que confere `portal_can_access_client(auth.uid(), _client_id)` e devolve `id, invoice_number, issue_date, gross_value, status, direction ('saida' se issuer_cnpj = CNPJ da empresa, 'entrada' se taker_cnpj = CNPJ da empresa), counterpart_cnpj, counterpart_name` (nome extraído de `raw_data` quando existir). REVOKE de public/anon, GRANT EXECUTE a authenticated. A tabela `invoices` continua fechada pelo "Portal client guard".
- `src/pages/Portal.tsx` (`NotasView`): somar o resultado da RPC à lista conforme a aba, `kind: 'NFS-e'`, filtro de tipo; `Nota.kind` ganha 'NFS-e'.
- AGENTS.md: incluir `portal_nfse` na regra das RPCs do portal.
