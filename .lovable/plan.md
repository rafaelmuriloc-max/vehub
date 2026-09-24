# Botão "Extrato PGDAS" no Simples Nacional

## O que muda
Em Fiscal > Simples Nacional, ao abrir uma empresa, cada mês ganha o botão **Extrato**, ao lado de "Declaração". Ele baixa o PDF do extrato do PGDAS-D daquele mês direto da Receita.

## Comportamento
- Aparece em todos os meses, pago ou em aberto.
- Se o sistema já sabe o número do DAS do mês, pede o extrato na hora.
- Se não sabe, primeiro busca na Receita a lista de declarações e guias do ano da empresa, acha o número do DAS do mês, guarda e então pede o extrato.
- Se o mês não tiver declaração transmitida, mostra o aviso "Nenhuma declaração/DAS encontrada para este mês".
- O PDF abre em nova aba (ou baixa como `Extrato_PGDAS_AAAAMM.pdf`) e fica salvo para abrir de novo sem nova consulta.
- Spinner no botão enquanto consulta; os outros botões do mês ficam travados.

## Técnico
- Arquivo: `src/components/simples-nacional/CompetenciaRow.tsx`.
- Nova ação `extrato`: `PGDASD / CONSEXTRATO16` com `{ numeroDas }`.
- Sem `numero_das`: chamar antes `PGDASD / CONSDECLARACAO13` com `{ anoCalendario }`, localizar o período `AAAAMM` e pegar o número do DAS da resposta; gravar em `simples_nacional_competencias.numero_das`.
- Reaproveita o campo `comprovante_pdf_base64` (é o mesmo serviço do "Comprovante"); o botão "Comprovante" deixa de existir, substituído por "Extrato", evitando dois botões iguais.
- Sem mudanças de banco nem de funções no servidor.
