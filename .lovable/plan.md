# Saúde do Supabase (verificado em 02/10/2026, 01:35 UTC)

## Resultado

| Serviço | Situação |
|---|---|
| Banco de dados (consultas) | Fora do ar: sem resposta em 25s |
| Login (auth) | Fora do ar: sem resposta em 25s |
| Pool de conexões | Indisponível |
| Arquivos (storage) | OK (0,5s) |
| Funções (edge functions) | Respondendo |

Por isso a tela de login não entra e as listas do sistema não carregam. O problema está no banco do Supabase, não no código do app. Os sinais (pool de conexões indisponível e login travado) apontam para um projeto pausado, reiniciando ou sobrecarregado. A causa exata não foi confirmada, porque só aparece no painel do Supabase.

## O que fazer (no painel do Supabase, feito pelo dono da conta)

1. Abrir https://supabase.com/dashboard/project/ismgjjvarzzfsbdpthot e ver o status do projeto.
2. Se estiver "Paused", clicar em "Restore project".
3. Se estiver "Unhealthy" ou com CPU/memória/disco no limite (em Reports e Database > Usage), reiniciar o projeto ("Restart project" em Settings > General) ou aumentar o plano ou o tamanho da instância.
4. Conferir se a cota do plano não foi estourada (Billing > Usage).

## Depois que voltar

Eu rodo uma nova verificação: tempo das consultas, número de conexões, tamanho do banco, consultas lentas e alertas de segurança. Assim dá para confirmar a causa e evitar que aconteça de novo, por exemplo por rotinas automáticas pesadas que concorrem ao mesmo tempo.

Nenhuma alteração no app é necessária agora.
