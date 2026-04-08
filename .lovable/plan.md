

# Corrigir textos do XML do Termo de Autorização

## Problema

O SERPRO retorna: **"atributo texto da tag termo inválido"**. O XML atual usa textos personalizados escritos manualmente. A documentação oficial do SERPRO mostra que os textos devem ser **exatamente** os textos padronizados, sem alteração.

## Textos oficiais (extraídos do PDF do SERPRO)

**termo**: `"Autorizo a empresa CONTRATANTE, identificada neste termo de autorização como DESTINATÁRIO, a executar as requisições dos serviços web disponibilizados pela API INTEGRA CONTADOR, onde terei o papel de AUTOR PEDIDO DE DADOS no corpo da mensagem enviada na requisição do serviço web. Esse termo de autorização está assinado digitalmente com o certificado digital do PROCURADOR ou OUTORGADO DO CONTRIBUINTE responsável, identificado como AUTOR DO PEDIDO DE DADOS."`

**avisoLegal**: `"O acesso a estas informações foi autorizado pelo próprio PROCURADOR ou OUTORGADO DO CONTRIBUINTE, responsável pela informação, via assinatura digital. É dever do destinatário da autorização e consumidor deste acesso observar a adoção de base legal para o tratamento dos dados recebidos conforme artigos 7º ou 11º da LGPD (Lei n.º 13.709, de 14 de agosto de 2018), aos direitos do titular dos dados (art. 9º, 17 e 18, da LGPD) e aos princípios que norteiam todos os tratamentos de dados no Brasil (art. 6º, da LGPD)."`

**finalidade**: `"A finalidade única e exclusiva desse TERMO DE AUTORIZAÇÃO, é garantir que o CONTRATANTE apresente a API INTEGRA CONTADOR esse consentimento do PROCURADOR ou OUTORGADO DO CONTRIBUINTE assinado digitalmente, para que possa realizar as requisições dos serviços web da API INTEGRA CONTADOR em nome do AUTOR PEDIDO DE DADOS (PROCURADOR ou OUTORGADO DO CONTRIBUINTE)."`

## Diferenças encontradas

| Aspecto | Atual (errado) | Oficial (correto) |
|---|---|---|
| termo | Texto personalizado com nome da empresa | Texto fixo padronizado com "CONTRATANTE" |
| avisoLegal | Texto genérico sobre sigilo fiscal | Texto sobre LGPD com artigos específicos |
| finalidade | Texto curto sobre prestação de serviços | Texto sobre consentimento do PROCURADOR |
| Formato tags | `<tag></tag>` | `<tag />` (self-closing) |

## Solução

### `supabase/functions/integra-contador/index.ts`

1. **Substituir os 3 textos** na função `generateSerproProcuradorXML` pelos textos oficiais exatos do SERPRO
2. **Usar tags self-closing** (`/>`) para sistema, termo, avisoLegal, finalidade, dataAssinatura, vigencia, destinatario, assinadoPor -- conforme o exemplo oficial
3. **Não incluir** `<?xml version="1.0" encoding="UTF-8"?>` no XML pois o exemplo oficial não o inclui na raiz (verificar impacto no digest)
4. **Ajustar `signXmlWithCertificate`** para inserir a assinatura antes de `</termoDeAutorizacao>` considerando que agora as tags filhas são self-closing

## Arquivo alterado
- `supabase/functions/integra-contador/index.ts` — substituir ~6 linhas de texto + ajuste de formato de tags

