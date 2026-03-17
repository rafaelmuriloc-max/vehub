

# Diagnóstico: Notas não estão sendo salvas corretamente

## Problema encontrado

A análise dos logs e do banco mostra:

1. **ADN retornou documentos com sucesso**: Para a Pousada Coração do Parque, foram buscados 120 documentos (NSU 0→50→100→120). Para a Pousada Caminho dos Sonhos, 200 documentos (NSU 0→50→100→150→200).

2. **Apenas 1 invoice foi salva no banco**, e essa única invoice é na verdade um **evento de cancelamento** (`<evento>`), não uma NFS-e. Ela não tem `issue_date`, `invoice_number` nem `gross_value`.

3. **O `last_nsu` foi persistido** (120 e 200), então syncs subsequentes começam do final e encontram 0 documentos novos.

## Causa raiz

O campo `ArquivoXml` no `LoteDFe` contém XML comprimido com gzip e codificado em base64. A descompressão funciona, mas o **parsing das NFS-e nacionais falha** porque:

- `extractStandaloneXmlDocuments` procura elementos raiz como `<NFS-e>`, `<NFSe>`, `<CompNfse>`, etc. — mas o padrão nacional de NFS-e usa estruturas diferentes (ex: `<NFSe>` dentro de um envelope `<nfseProc>` ou diretamente como `<NFSe>` com namespace `http://www.sped.fazenda.gov.br/nfse`).
- Documentos que são **eventos** (`<evento>`) caem no fallback genérico, mas não contêm dados de NFS-e.
- A função `parseInvoiceXml` retorna `null` para a maioria dos documentos porque os campos esperados não são encontrados nas tags XML do padrão nacional.

## Plano de correção

### 1. Adicionar log de diagnóstico temporário no parsing
- Logar o início do XML decomprimido (primeiros 300 chars) de cada `ArquivoXml` para identificar exatamente a estrutura XML retornada pelo ADN nacional.
- Logar quantos documentos XML foram extraídos vs quantos invoices foram parseados.

### 2. Expandir padrões de extração XML
- Adicionar padrões de root element do padrão nacional: `<NFSe>` com namespace SPED, `<DFe>`, `<nfse>`, `<infNFSe>`.
- Tratar o fallback para aceitar qualquer XML que contenha tags de NFS-e, mesmo sem root element reconhecido.

### 3. Expandir tags de parsing no `parseInvoiceXml`
- Adicionar tags do padrão nacional da NFS-e (SPED/ABRASF): `nNFSe`, `dhEmi`, `vServ`, `vLiq`, `CNPJPrest`, `CNPJTom`, etc.
- Relaxar a condição de retorno `null`: aceitar documentos que tenham pelo menos um campo válido (access_key OU issueDate OU invoiceNumber).

### 4. Separar eventos de NFS-e
- Detectar se o XML é um `<evento>` e marcá-lo com status apropriado (ex: `cancelada`) em vez de tentar parsear como NFS-e.
- Linkar eventos de cancelamento à NFS-e correspondente via `chNFSe`.

### 5. Resetar `last_nsu` e re-sincronizar
- Criar migração para resetar `last_nsu` dos dois clientes afetados para `NULL`, permitindo re-fetch completo.
- Só atualizar `last_nsu` se pelo menos 1 invoice foi salva com sucesso.

### Migração de banco

```sql
UPDATE clients SET last_nsu = NULL WHERE last_nsu IS NOT NULL;
```

### Arquivos alterados

- `supabase/functions/nfse-query/index.ts` — Melhorar parsing XML, adicionar diagnóstico, corrigir lógica de `last_nsu`

