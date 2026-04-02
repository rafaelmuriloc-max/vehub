

# Download direto de XML e DANFE PDF no sistema

## Situação atual
- **XML**: Já baixa via edge function `nfe-download`, mas precisa buscar no AN se não estiver em cache. Funciona.
- **PDF (DANFE)**: Apenas abre o portal da Fazenda em nova aba (requer captcha manual). Não baixa direto.

## Solução

Usar a biblioteca `node-sped-pdf` (compatível com browser via ESM) para gerar o DANFE PDF diretamente no frontend a partir do XML completo.

### Fluxo
```text
1. Usuário clica "Baixar XML" → edge function retorna signed URL → download direto ✓ (já funciona)
2. Usuário clica "Baixar DANFE" → 
   a. Chama edge function nfe-download type=xml para obter o XML completo
   b. Com o XML em mãos, usa node-sped-pdf no browser para gerar o PDF
   c. Dispara download automático do PDF gerado
```

### Alterações

#### 1. Instalar `node-sped-pdf` no projeto
- `npm install node-sped-pdf`

#### 2. Atualizar `src/components/invoices/NfeTab.tsx`
- Importar `DANFe` de `node-sped-pdf`
- Reescrever `handleDownloadPdf`:
  1. Chamar `nfe-download` com `type: "xml"` para obter a signed URL do XML completo
  2. Fetch do XML via signed URL
  3. Passar o XML para `DANFe({ xml })` que retorna um Blob PDF
  4. Disparar download do blob como `{chave}.pdf`
- Adicionar estado de loading para o botão PDF (já existe pattern com `downloadingMap`)
- Trocar ícone de `ExternalLink` para `FileText` (já importado)

#### 3. Edge function `nfe-download` — sem alteração
Já retorna signed URL do XML completo. O PDF será gerado no frontend.

## Arquivos
- `package.json` (adicionar `node-sped-pdf`)
- `src/components/invoices/NfeTab.tsx` (~30 linhas alteradas no handler de PDF + import)

