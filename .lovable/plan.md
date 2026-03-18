

# Filtrar certificados de pessoa física e vencidos na importação

## O que será feito

Duas filtragens automáticas durante o processamento dos certificados na pasta:

1. **Pessoa física (CPF)**: Se o certificado contiver apenas CPF (11 dígitos) em vez de CNPJ (14 dígitos), será descartado com status de erro "Certificado de pessoa física"
2. **Certificados vencidos**: Se `validity.notAfter` for anterior à data atual, será descartado com status de erro "Certificado vencido"

Ambos aparecerão na tabela de preview com badge de erro e motivo, mas não serão contados como importáveis.

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/components/CertificateImportDialog.tsx` | Adicionar verificação de vencimento após extrair `expiry` (linha ~149) e tratar ausência de CNPJ de 14 dígitos como "pessoa física" quando houver CPF de 11 dígitos (linha ~152). Adicionar contadores de "ignorados" no resumo do preview. |

## Detalhes

Na função `handleFolderSelect`, após extrair o certificado:

1. Verificar `foundCert.validity.notAfter < new Date()` → marcar como erro "Certificado vencido (DD/MM/AAAA)"
2. Na extração de CNPJ, se não encontrar 14 dígitos mas encontrar 11 dígitos (CPF), marcar como erro "Certificado de pessoa física (CPF)"
3. Adicionar um badge "Ignorado" na cor cinza para esses casos, ou reutilizar o badge de erro existente com a mensagem descritiva

