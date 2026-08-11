# Obrigações ainda em "Excluídas" de clientes ativos

## Diagnóstico (verificado no banco agora)

Restam **342 instâncias excluídas** de clientes ativos sem data de saída. Elas se dividem em dois grupos com causas diferentes:

**Grupo A — 27 instâncias com vínculo válido no cadastro, todas já concluídas.**
O reparo anterior só restaurou instâncias não concluídas, então essas ficaram para trás. São de clientes como Pousada Safari (Folha 08/2026), Empreiteira Schmitz, Velocitá, Lavar Lavanderia, Bianca Domeciano, Pousada Juliane Penha, entre outros. Trabalho já feito que hoje aparece como excluído.

**Grupo B — 315 instâncias de 26 clientes cuja obrigação está realmente desmarcada no cadastro.**
Exemplos: Pousada Juliane Ltda ME (25), Atum Fish (20), Lavar - Lavanderia Armação (19), Matiello Incorporadora (18), Molinha Pousada (18), Armazém Baldoro (17). Boa parte parece cadastro incompleto do Departamento Pessoal: 11 clientes têm Folha/FGTS/Darf Previdenciário excluídos e não possuem o vínculo dessas obrigações; três deles (Atum Fish, Molinha, Armazém Baldoro) têm apenas 2 vínculos no total. Dois clientes (Josilene dos Santos e Nelsa Ana Bertol) não têm nenhum vínculo cadastrado.

Aqui o sistema está tecnicamente correto: sem vínculo, a obrigação fica excluída. O problema é de cadastro, não de código.

## Correção proposta

1. **Restaurar o Grupo A**: reativar as 27 instâncias concluídas de clientes ativos que possuem vínculo válido. Ajusta a lacuna do reparo anterior (que ignorava as concluídas).
2. **Grupo B — relatório, sem alteração automática**: listar os 26 clientes e as obrigações faltantes para conferência pelo time, em vez de recriar vínculos que podem ter sido desmarcados de propósito. Depois da sua confirmação (total ou por cliente), marco os vínculos e as instâncias voltam sozinhas pelo gatilho de restauração já existente.

## Detalhes técnicos

- Grupo A: `UPDATE obligation_instances SET deleted_at = NULL` para instâncias `deleted_at IS NOT NULL`, cliente `status='active'` e `end_date IS NULL`, com registro correspondente em `client_department_obligations`. Sem filtro de status, portanto inclui as `done`.
- Grupo B: nenhuma migração — apenas a listagem em chat (cliente, obrigações sem vínculo, quantidade de instâncias excluídas), para você decidir quais vínculos devem ser marcados.
- Nenhuma mudança em gatilhos: `trg_cdo_insert_restore_future` e o gatilho de `end_date` continuam como estão.
