# Importação: ignorar funcionários já cadastrados

## Regra nova
Durante a sincronização da pasta (PDF, CSV, HTML do SCI), se o funcionário **já existe** no cadastro da empresa (identificado pelo CPF ou, sem CPF, pelo nome), ele é **simplesmente desconsiderado**: nenhum campo é preenchido, alterado ou tocado. Hoje o importador completa campos vazios — isso deixa de acontecer.

- Quem **não existe** continua sendo cadastrado normalmente.
- Nada é excluído e nada que você digitou é alterado — agora nem os campos vazios são completados.
- O resumo da sincronização passa a mostrar quantos foram **ignorados por já existirem**.

## Detalhes técnicos
- `supabase/functions/employee-folder-sync/index.ts`: no loop de gravação, ao encontrar funcionário existente (mesma regra de busca atual — CPF normalizado ou nome na mesma empresa), pula sem `update`; remove o trecho que completava campos nulos.
- `stats` ganha `funcionarios_ignorados`; o toast em `src/pages/Personnel.tsx` exibe "X já cadastrado(s) ignorado(s)".

## Validação
- `bunx tsgo --noEmit` e build limpos.
- Nova sincronização com a pasta: funcionários já cadastrados não devem ter nenhum campo alterado e devem aparecer na contagem de ignorados.
