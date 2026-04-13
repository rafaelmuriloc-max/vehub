

# Garantir botões de Visualizar/Baixar PDF no resultado SITFIS

## Análise

O código **já possui** a lógica genérica de extração de PDFs base64 (`extractFilesFromResponse`) e renderização dos botões "Visualizar" e "Baixar" (linhas 766-799 de `IntegraContador.tsx`). A resposta do SERPRO para `RELATORIOSITFIS92` retorna o PDF dentro de `data.dados` como `{"pdf":"JVBERi0x..."}`, que é exatamente o formato que a função `extractFilesFromResponse` já processa.

Se os botões não estão aparecendo, pode ser por um dos seguintes motivos:
1. O campo `dados` no nível raiz da resposta (fora de `data`) está sendo lido primeiro e não contém o PDF
2. O nome do arquivo padrão é genérico ("documento.pdf")

## Mudanças

### `src/pages/IntegraContador.tsx`

1. **Melhorar `extractFilesFromResponse`** para também buscar o PDF em caminhos alternativos da resposta SERPRO (`res?.data?.data?.dados`, `res?.dados`), garantindo que qualquer variação de estrutura seja coberta

2. **Adicionar nome descritivo** para arquivos SITFIS: quando o serviço é `RELATORIOSITFIS92`, usar o nome "Relatório Situação Fiscal.pdf" em vez de "documento.pdf"

3. **Fallback explícito**: se `extractFilesFromResponse` não encontrar PDFs pelo walk genérico, tentar extrair diretamente `dados.pdf` como string base64

Essas são mudanças pequenas e localizadas na função de extração e na renderização existente.

## Arquivos

| Arquivo | Mudança |
|---------|--------|
| `src/pages/IntegraContador.tsx` | Melhorar `extractFilesFromResponse` com mais caminhos de busca e nome descritivo para SITFIS |

