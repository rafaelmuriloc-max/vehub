# Importação: atualizar rescisão em funcionário já cadastrado

## Ajuste da regra
Funcionário já cadastrado continua sendo **ignorado** (nenhum campo preenchido ou alterado) — **com uma exceção**: quando a ficha importada trouxer **data de rescisão**, o cadastro existente é atualizado com essa data e a situação passa para **Desligado**. Vale para cadastros manuais e importados.

- Ficha sem rescisão → funcionário existente totalmente ignorado (regra atual).
- Ficha com rescisão → grava `termination_date` e `status = terminated` no cadastro existente; os demais campos (nome, CPF, cargo, admissão, salário) não são tocados.
- Quem não existe continua sendo cadastrado normalmente.
- O resumo da sincronização passa a mostrar quantos foram **atualizados com rescisão**.

## Detalhes técnicos
- `supabase/functions/employee-folder-sync/index.ts`: no ramo de funcionário existente, se `pe.termination_date` estiver presente, faz `update` apenas de `termination_date` e `status` (terminated quando a data não é futura em São Paulo) e conta em `stats.funcionarios_atualizados`; caso contrário, conta em `funcionarios_ignorados`.
- `src/pages/Personnel.tsx`: toast volta a exibir "X atualizado(s) com rescisão" além dos ignorados.

## Validação
- `bunx tsgo --noEmit` e build limpos.
- Nova sincronização: os 3 desligados da ficha da CAMIM devem refletir a rescisão nos cadastros existentes.
