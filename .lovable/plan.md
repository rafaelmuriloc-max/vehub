

# Plano: Filtro por data de emissão + Exportação XML em lote (ZIP)

## 1. Filtro por data de emissão

Adicionar dois campos de data (Data Início e Data Fim) ao lado do filtro de cliente existente (linha ~270-285). Usar inputs `type="date"` simples. O filtro será aplicado no `filteredInvoices` comparando `issue_date` com o range selecionado.

**Estados novos**: `filterDateFrom`, `filterDateTo` (strings, inicialmente vazios).

**Lógica de filtro** (atualizar `filteredInvoices`):
```typescript
let filtered = invoices;
if (filterClient !== 'all') filtered = filtered.filter(i => i.client_id === filterClient);
if (filterDateFrom) filtered = filtered.filter(i => i.issue_date && i.issue_date >= filterDateFrom);
if (filterDateTo) filtered = filtered.filter(i => i.issue_date && i.issue_date <= filterDateTo);
```

## 2. Exportação XML em lote (ZIP)

Adicionar um botão "Exportar XMLs" ao lado dos filtros. Ao clicar:

1. Filtra as notas visíveis que possuem `access_key`
2. Para cada nota, chama `handleDownload` individual ou busca a signed URL (se `xml_url` existe, cria signed URL; senão chama `nfse-download`)
3. Usa a biblioteca **JSZip** (já leve, ~45KB) para agrupar todos os XMLs em um ZIP
4. Dispara o download do ZIP via blob

**Dependência**: Adicionar `jszip` ao `package.json`.

**Fluxo do botão**:
```typescript
async function handleBatchExportXml() {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const targets = filteredInvoices.filter(i => i.access_key);
  
  for (const inv of targets) {
    // Get signed URL (existing or via edge function)
    const url = await getXmlSignedUrl(inv);
    if (url) {
      const resp = await fetch(url);
      const blob = await resp.blob();
      zip.file(`${inv.access_key || inv.invoice_number}.xml`, blob);
    }
  }
  
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(URL.createObjectURL(zipBlob), `nfse-xml-export.zip`);
}
```

Extrair a lógica de obter signed URL do `handleDownload` em uma função reutilizável `getSignedUrl(inv, type)`.

## Arquivos

- **Instalar**: `jszip` via package.json
- **Editar**: `src/pages/Invoices.tsx`
  - Adicionar estados `filterDateFrom`, `filterDateTo`
  - Adicionar inputs de data no cabeçalho da tabela
  - Atualizar lógica de `filteredInvoices`
  - Adicionar botão "Exportar XMLs" com estado de loading
  - Extrair `getSignedUrl()` do `handleDownload`
  - Implementar `handleBatchExportXml()`

