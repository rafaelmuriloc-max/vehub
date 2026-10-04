# Nome do destinatário nas NFS-e emitidas (portal do cliente)

## O que muda para o cliente
- Na aba **Emitidas**, cada nota de serviço mostra ao lado do número o nome de quem recebeu o serviço (tomador), por exemplo "Nº 123 · ASSOCIACAO CORAL VOZES DO VALE".
- Se a nota não tiver o nome, aparece o CNPJ/CPF do tomador.
- A busca da aba Emitidas também passa a encontrar pelo nome do destinatário.
- NF-e/NFC-e emitidas não mudam.

## Detalhes técnicos
- Migração: atualizar `portal_nfse` para preencher `counterpart_name` também nas emitidas, lendo `<toma>...<xNome>` do XML (`raw_data->>'xml'`); mantém a checagem `portal_can_access_client` e os mesmos GRANTs.
- `src/pages/Portal.tsx`: `NotasList` mostra `emitter_name` também na aba Emitidas para itens NFS-e; placeholder da busca vira "Buscar por número ou destinatário".
