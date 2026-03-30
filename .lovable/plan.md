

# Configuração visual de extração — anotação no documento

## Resumo
Substituir os campos de texto por uma interface visual onde o usuário faz upload do PDF, visualiza o documento renderizado e desenha retângulos sobre as áreas onde estão CNPJ, Nome da Empresa, Competência e Tipo de Obrigação. As coordenadas dos retângulos são salvas no `extraction_config`.

## Fluxo do usuário
1. No formulário do Tipo de Documento, faz upload do arquivo-modelo
2. Aparece botão "Configurar Campos" (habilitado após upload)
3. Ao clicar, abre um dialog fullscreen com layout dividido:
   - **Esquerda (~70%)**: PDF renderizado (usando `react-pdf` / pdf.js)
   - **Direita (~30%)**: Lista dos 4 campos (CNPJ, Nome, Competência, Obrigação) com botões coloridos
4. Usuário clica em um campo na lista (ex: "CNPJ") — ele fica ativo/selecionado
5. Usuário desenha um retângulo sobre a área do PDF onde está aquele dado
6. O retângulo fica visível com cor e label do campo
7. Pode redesenhar (substitui o anterior) ou limpar
8. Ao confirmar, as coordenadas são salvas no `extraction_config`

## Mudanças

### 1. Instalar `react-pdf`
- `npm install react-pdf` — wrapper do pdf.js para renderizar PDFs no browser
- Configurar o worker do pdf.js no componente

### 2. Novo componente `src/components/settings/DocumentFieldAnnotator.tsx`
- Props: `file: File | string` (File local ou URL do storage), `extractionConfig`, `onSave(config)`
- Renderiza o PDF com `<Document>` e `<Page>` do react-pdf
- Canvas overlay transparente sobre a página para desenhar retângulos
- Painel lateral com os 4 campos, cada um com cor distinta (ex: azul, verde, laranja, roxo)
- Estado: `activeField` (qual campo está sendo marcado), `regions` (mapa campo→coordenadas)
- Mouse events: `onMouseDown` inicia retângulo, `onMouseMove` redimensiona, `onMouseUp` finaliza
- Navegação de páginas (anterior/próxima) para documentos multipágina
- Coordenadas salvas como `{ page, x, y, width, height }` relativas ao tamanho da página (percentual)

### 3. Atualizar `extraction_config` no banco
- Formato muda de texto livre para coordenadas:
```json
{
  "cnpj_region": { "page": 1, "x": 5.2, "y": 12.1, "width": 30.5, "height": 3.2 },
  "company_name_region": { "page": 1, "x": 5.2, "y": 15.8, "width": 40.0, "height": 3.0 },
  "reference_month_region": null,
  "obligation_type_region": null
}
```
- Valores em percentual (0-100) para independência de resolução

### 4. Atualizar `DocumentTypesTab.tsx`
- Remover os 4 inputs de texto da configuração de extração
- Adicionar botão "Configurar Campos" que abre o `DocumentFieldAnnotator` em dialog fullscreen
- O botão fica habilitado quando há um arquivo-modelo (upload novo ou existente)
- Para arquivo existente no storage, gerar signed URL para visualização

### 5. Atualizar `ExtractionConfig` interface
- Substituir campos `*_location: string` por `*_region: { page, x, y, width, height } | null`

## Detalhes técnicos
- Biblioteca: `react-pdf` (usa pdf.js internamente, renderiza canvas)
- O overlay de desenho é um `<canvas>` ou `<div>` com position absolute sobre o PDF
- Coordenadas em percentual garantem que funcionam independente do zoom
- O dialog de anotação usa `max-w-[95vw] max-h-[95vh]` para ocupar quase toda a tela
- Para arquivos já no storage, usa `supabase.storage.from('documents').createSignedUrl()` para obter URL temporária
- Para arquivos recém-selecionados (File local), usa `URL.createObjectURL()`
- Nenhuma migração necessária — o campo `extraction_config` já é `jsonb` flexível

