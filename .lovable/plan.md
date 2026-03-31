

# Corrigir encoding do XML do Termo de Autorização (procuração)

## Problema
O erro `[EntradaIncorreta-AUTENTICAPROCURADOR-016] Layout do XML inválido: atributo texto da tag termo inválido` ocorre porque o `btoa()` na linha 151 não suporta caracteres UTF-8 corretamente. O XML do Termo de Autorização contém caracteres acentuados (ç, ã, é, ó) que