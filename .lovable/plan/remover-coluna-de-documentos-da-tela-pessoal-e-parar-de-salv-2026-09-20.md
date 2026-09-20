# Remover coluna de Documentos da tela Pessoal e parar de salvar arquivos

## Objetivo
Tirar a coluna "Documentos" da lista de funcionários na página Pessoal e parar de salvar os arquivos do Drive no armazenamento do sistema — os PDFs passam a ser apenas lidos para extrair os dados.

## Mudanças

1. **Página Pessoal** (`src/pages/Personnel.tsx`)
   - Remover a coluna "Documentos" da tabela de funcionários (cabeçalho, células e o ajuste de `colSpan` da linha vazia).
   - Remover o clique que abria o arquivo (link assinado) associado a essa coluna.
   - Manter a seção "Aguardando revisão" no topo (ela usa o histórico de arquivos processados, não a coluna).

2. **Sincronização** (`supabase/functions/employee-folder-sync/index.ts`)
   - Remover o upload do arquivo para o armazenamento (`documents` bucket): o PDF continua sendo baixado apenas em memória para a leitura por IA.
   - Continuar registrando cada arquivo processado em `employee_documents` (sem caminho de armazenamento), pois esse registro é o que evita reprocessar arquivos iguais e alimenta a lista de "Aguardando revisão".

3. **Dados e banco**: sem migração. Arquivos já salvos anteriormente no armazenamento permanecem onde estão (nada é excluído). Registros antigos de documentos continuam existindo, só deixam de ser exibidos na tabela.

## Validação
- `bunx tsgo --noEmit` e build limpos.
- Conferir que a tabela de funcionários não mostra mais a coluna e que a sincronização continua importando/atualizando funcionários normalmente.
