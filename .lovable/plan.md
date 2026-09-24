# Corrigir funcionários da empresa Juracy Coutinho Franco Junior

## O que foi encontrado
- A empresa tem 33 funcionários cadastrados, todos criados na mesma sincronização de 21/09/2026 (14:28–14:40).
- Só 1 é de fato dela: JURACY COUTINHO FRANCO JUNIOR (código 1, sócio, pró-labore R$ 1.302).
- Os outros 32 são de outras empresas (ex.: sócios e funcionários de outros clientes). 22 deles já existem também na empresa correta.
- Nenhum dos 32 tem férias ou prazos de experiência ligados.
- É resto da importação antiga que caía na Juracy quando a ficha não tinha empresa identificada — esse caminho já foi bloqueado depois.

## O que será feito
1. Tirar da Juracy os 32 cadastros errados, mantendo apenas o sócio Juracy.
   - Os 22 que já existem na empresa certa: removidos da Juracy (são duplicados).
   - Os outros 10: também removidos da Juracy; voltam na empresa correta na próxima sincronização de "Pasta (fichas)", que agora identifica a empresa pelo CNPJ da própria ficha.
2. Antes de apagar, gerar uma lista (nome, CPF, cargo) desses 32 para você conferir, e só apagar após sua confirmação.
3. Depois, conferir que a Juracy mostra 1 funcionário na página Pessoal.

## Detalhes técnicos
- Exclusão em `client_employees` onde `client_id` = Juracy e `id` <> registro do sócio (60d8a3b4…), limitada aos 32 IDs listados.
- Sem mudança de código nem de estrutura do banco.
