# Código do funcionário na lista

Hoje a lista de funcionários começa pelo nome. O código que aparece na ficha de registro (campo "Código", circulado na imagem) é lido dos relatórios, mas não é guardado nem exibido.

## O que muda

- Nova coluna **Código**, antes do nome, na lista de funcionários de cada empresa.
- O código passa a ser gravado no cadastro na sincronização: vem da ficha de registro do SCI e também do relatório de previsão de contrato de experiência.
- Funcionário que já existe e está sem código recebe o código na próxima sincronização; códigos já preenchidos não são sobrescritos.
- No cadastro/edição manual, campo **Código** disponível para preencher ou corrigir.
- Ordenação da lista passa a ser por código quando houver, e por nome nos que estiverem sem código.
- Quem não tiver código mostra "—". A coluna aparece também no celular (é curta).
- A busca da página passa a encontrar por código, além de nome e CPF.

Depois de publicado, basta clicar em **Sincronizar pasta** para os códigos aparecerem.

## Detalhes técnicos

- Migração: `client_employees` ganha `employee_code text` (nullable). Sem novas policies/grants.
- `supabase/functions/employee-folder-sync/index.ts`: incluir `employee_code` no insert e, no update, preencher só quando o registro estiver vazio (mesma regra dos demais campos). Os parsers `sciHtml.ts` e `sciTrial.ts` já retornam o campo.
- `src/pages/Personnel.tsx`: campo no tipo `Employee`, `TableHead`/`TableCell` antes do nome, campo no diálogo de edição, `order by` e filtro de busca ajustados.
- Validação: `deno test` dos parsers, `bunx tsgo --noEmit`, build limpo, deploy da função e conferência numa empresa (ex.: ELOARTH CONSTRUCAO) comparando com a ficha.
