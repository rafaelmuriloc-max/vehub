# Controle de vencimento de férias

Novo botão "Sincronizar férias" na página Pessoal, lendo o relatório "Acompanhamento de vencimento de férias" do SCI, e um controle de vencimentos na tela.

## Como vai funcionar

**Botão "Sincronizar férias"**
- Fica ao lado de "Sincronizar experiência" e "Sincronizar pasta".
- Lê da pasta do Drive apenas os arquivos de acompanhamento de férias (nome contendo "vencimento de férias"); os demais são ignorados.
- Cada linha do relatório é um período aquisitivo: código do funcionário, nome, dias de direito, período aquisitivo, período para gozar e prazo final para iniciar sem gerar dobro.
- A empresa vem do cabeçalho do bloco ("Empresa: 195 - CAMIM LTDA ... CNPJ:..."), como já é feito no relatório de experiência.
- O funcionário é localizado na empresa pelo código e, se não houver, pelo nome. Quem não existir é cadastrado.
- Cada sincronização substitui os períodos daquele funcionário pelos do relatório (o relatório é sempre a foto atual). Nenhum funcionário é excluído.
- Arquivo sem empresa reconhecida fica de fora, com aviso no resumo.

**Na tela Pessoal**
- Clicando no funcionário, a linha expande e mostra abaixo os períodos de férias dele, na mesma apresentação do relatório: Dias de direito | Referente Período Aquisitivo | Deverá gozar as férias entre o período | Prazo final p/ iniciar as férias sem gerar dobro. Um período por linha, do mais antigo para o mais novo.
- Períodos já vencidos aparecem em vermelho e os que vencem em até 60 dias em laranja; funcionário sem férias importadas mostra um aviso curto.
- Novo card "Férias a vencer em 60 dias", com contador de já vencidas, clicável: abre uma janela com os funcionários agrupados por empresa (código, nome, dias de direito, período aquisitivo, data limite e quantos dias faltam), no mesmo padrão da janela de experiências.

## Detalhes técnicos

- Migração: tabela `employee_vacation_periods` (employee_id → client_employees, client_id, acquisition_start, acquisition_end, days_right numeric, enjoy_start, enjoy_end, deadline_date, source_file, created_at) com índice único por (employee_id, acquisition_start) e índice por client_id. GRANTs (`authenticated` CRUD, `service_role` ALL) antes do `ENABLE ROW LEVEL SECURITY`, políticas no mesmo padrão de `client_employees`.
- Novo parser `supabase/functions/employee-folder-sync/sciVacation.ts` (sem IA), reaproveitando `htmlToCells`/`alignRows` do padrão FastReport: detecta o título "Acompanhamento de vencimento de férias", os cabeçalhos de empresa e a grade `Cod. | Nome do colaborador | Dias de direito | Referente Período Aquisitivo | Deverá gozar as férias entre o período | Prazo final p/ iniciar as férias sem gerar dobro` (colspans 2,2,1,1,3,3). Datas dd/mm/aaaa, dias em formato brasileiro ("27,50"), célula vazia (`&nbsp;`) → nulo. Testes em `sciVacation.test.ts` com o relatório real da CAMIM (28 linhas, funcionário com vários períodos, prazo final vazio).
- `employee-folder-sync/index.ts`: novo modo `only: "ferias"` (análogo a `only: "experiencia"`), com `isVacationFileName`, sem IA e sem empresa padrão; grava os períodos via delete+insert por funcionário e devolve estatísticas (`ferias_periodos`, `ferias_funcionarios`, `linhas_ignoradas`).
- `src/pages/Personnel.tsx`: estado `syncingVacation`, botão, carga de `employee_vacation_periods`, coluna, card e dialog de férias.
- Validação: `deno test -A supabase/functions/employee-folder-sync`, `bunx tsgo --noEmit` e build; deploy da função.
