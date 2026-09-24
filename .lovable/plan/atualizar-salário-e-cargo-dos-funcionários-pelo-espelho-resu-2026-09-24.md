# Atualizar salário (e cargo) dos funcionários pelo Espelho Resumo da Folha

## O que o relatório traz
Conferi o arquivo de agosto/2026 que você enviou. Para cada funcionário ele mostra: **código**, **nome**, **data de admissão** e **Salário base** (ex.: "Admissão em 01/11/2024 — Salário base 1.621,00").
**O cargo não aparece nesse relatório** — não há campo de cargo/função em nenhuma ficha. Por isso só o salário pode ser atualizado por ele; o cargo continua vindo da ficha de registro (Sincronizar → Pasta). Se o SCI permitir incluir o cargo no espelho, basta reenviar o modelo que eu passo a ler também.

## Como vai funcionar
- Ao usar **Sincronizar → Folha** (na Pessoal ou na tela Folha), além do resumo por empresa, o sistema lê cada funcionário do espelho.
- A empresa vem do CNPJ do bloco "Empresa: ... CNPJ" (nunca empresa padrão).
- O funcionário é localizado dentro daquela empresa pelo **código** ("007" = "7") e, se não achar, pelo **nome**.
- Encontrado: o **salário é sempre atualizado** com o "Salário base" do mês (mesmo se já houver valor digitado), como acontece com os prazos de experiência.
- Não encontrado: nada é criado; entra na contagem "não localizados" do aviso final.
- Se houver vários meses na pasta, vale o salário do **mês mais recente** (um mês antigo nunca sobrescreve um mais novo).
- Aviso ao final: "X salário(s) atualizado(s), Y funcionário(s) não localizado(s)".

## Detalhes técnicos
- `sciPayroll.ts`: novo retorno `employees[]` por empresa `{code, name, admission_date, base_salary}` extraído das linhas "código | nome | SF | IR | Admissão em dd/mm/aaaa Salário base N". Teste novo em `sciPayroll.test.ts` com o arquivo real.
- `employee-folder-sync/index.ts` (modo `only: "folha"`): ordena arquivos por competência, casa por `employee_code` normalizado → nome normalizado em `client_employees` do client, `update salary`. Stats `salarios_atualizados`, `nao_localizados`.
- Toasts em `Payroll.tsx` e `Personnel.tsx` mostram os novos números.
- Sem migração de banco.
