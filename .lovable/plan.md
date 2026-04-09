

# Exibir PDFs e arquivos da resposta SERPRO ao invés de JSON bruto

## Problema
A resposta do SERPRO para serviços como CONSULTIMADECREC14 retorna PDFs codificados em base64 dentro do campo `dados` (ex: `recibo.pdf`, `declaracao.pdf`). Atualmente o sistema exibe o JSON bruto com toda a string base64, quando deveria detectar esses arquivos e oferecer download/visualização.

## Solução

### Em `src/pages/IntegraContador.tsx`:

1. **Criar função `extractFilesFromResponse(result)`** que:
   - Parseia `data.dados` (string JSON) procurando campos com chaves `pdf`, `nomeArquivo` em qualquer nível
   - Retorna array de `{ name: string, base64: string, type: 'pdf' }` para cada arquivo encontrado
   - Suporta estruturas como `{ recibo: { nomeArquivo, pdf }, declaracao: { nomeArquivo, pdf }, maed: null }`

2. **Criar componente `renderSerproFiles(files, result)`** que:
   - Exibe cards para cada arquivo com nome e botão de download
   - Ao clicar, converte base64 em Blob (`application/pdf`), cria URL com `URL.createObjectURL` e abre em nova aba ou dispara download
   - Mantém o JSON bruto em accordion "Ver JSON completo" (sem os campos base64 gigantes para performance)

3. **Alterar o bloco de renderização do resultado** (linhas 587-595):
   - Antes de mostrar JSON bruto, verificar se há arquivos extraíveis
   - Se sim, renderizar com `renderSerproFiles`
   - Se não, manter o JSON formatado atual
   - Caixa Postal continua com tratamento específico existente

4. **Exibir também dados textuais** da resposta (ex: `numeroDeclaracao`) em formato legível acima dos botões de download.

## Detalhes técnicos

```typescript
// Converter base64 para download
function downloadBase64Pdf(base64: string, filename: string) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
```

## Arquivo alterado
- `src/pages/IntegraContador.tsx` — ~60 linhas adicionadas (funções de extração + renderização de arquivos)

## Resultado esperado
Quando o SERPRO retorna PDFs (recibo, declaração, guia DAS), o usuário vê botões de download ao invés de JSON com base64.

