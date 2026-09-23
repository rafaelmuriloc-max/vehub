# Módulo de Férias — Etapa 1

Nova aba **Férias** no menu, com painel gerencial de todas as empresas ou de uma empresa escolhida, usando os períodos já importados pelo botão "Sincronizar férias" (hoje: 361 períodos, 269 colaboradores, 58 empresas).

Nesta etapa ficam de fora: programação/calendário de férias, histórico de importações, relatório executivo em Excel/PDF e a conferência das diferenças em relação ao relatório. A importação continua exclusivamente pela pasta do Google Drive.

## O que a página terá

**Cabeçalho**
- Título Férias, seletor de empresas com busca (nome, CNPJ ou código), opção inicial "Todas as empresas", data de referência (padrão: hoje) e botão "Sincronizar férias" (mesma rotina do Drive já existente).

**Indicadores (cards clicáveis)**
- Total de colaboradores (sem contar a mesma pessoa duas vezes)
- Colaboradores com férias vencidas (destaque em vermelho)
- Dias de férias vencidas
- Férias adquiridas dentro do prazo (dias)
- Dias em formação (períodos ainda não concluídos)
- Próximos vencimentos, com escolha entre 30, 60 e 90 dias
- Saldo total de dias
- Empresas com pendências (só na visão consolidada)

Cada card abre a lista dos colaboradores (ou empresas) que formam aquele número.

**Gráficos**
- Situação das férias: vencidas, adquiridas no prazo e em formação; clicar numa fatia filtra a tabela.
- Férias por empresa (só na visão consolidada): barras com alternância entre total, vencidas, adquiridas e em formação; clicar numa barra seleciona a empresa.
- Vencimentos por mês: próximos 12 meses, dias com prazo a encerrar em cada mês.

**Tabela de colaboradores**
- Colunas: Colaborador, Empresa, Férias vencidas, Férias adquiridas, Dias em formação, Saldo total, Próximo prazo, Situação.
- Busca por nome, filtros por empresa, situação e intervalo de vencimento; ordenação por vencidas, saldo, prazo mais próximo ou nome.
- Situação com cores: vermelho (vencido), laranja (perto de vencer), verde (no prazo), azul (período em andamento), cinza (sem saldo). Quando a pessoa tem períodos em situações diferentes, vale a mais urgente.

**Detalhe do colaborador**
- Painel lateral com nome, empresa, código no SCI e saldo total; resumo de vencidos, adquiridos, em formação e nº de períodos; e a lista dos períodos aquisitivos um a um (período aquisitivo, dias de direito, período para gozar, prazo final, dias de atraso e situação), do mais antigo ao mais novo, sem agrupar.

## Regras de cálculo

Para cada período, na data de referência escolhida:
- **Vencido**: período aquisitivo já encerrado e prazo final (ou fim do período de gozo, quando o relatório não traz prazo) já passou.
- **Adquirido no prazo**: período aquisitivo encerrado e prazo ainda no futuro; "perto de vencer" quando faltam até 60 dias.
- **Em formação**: período aquisitivo ainda não encerrado na data de referência.
- Dias são sempre os "dias de direito" informados pelo relatório; nada é estimado.
- Nenhuma conclusão automática sobre pagamento em dobro.
- Quando a data de referência for posterior à data do último relatório importado, aparece um aviso de que os saldos podem estar desatualizados.

## Detalhes técnicos

- Nova página `src/pages/Vacations.tsx`, rota `/ferias` em `src/App.tsx` e item "Férias" (ícone de calendário) em `src/components/AppSidebar.tsx`.
- Dados lidos de `employee_vacation_periods` + `client_employees` + `clients`; sem nova tabela e sem alteração no banco nesta etapa.
- Cálculos concentrados num utilitário `src/lib/vacations.ts` (classificação do período, saldos por colaborador e por empresa, agregados por mês) para manter a página enxuta e testável.
- Gráficos com Recharts, seletor de empresa com Combobox (Popover + Command), demais componentes shadcn já usados no projeto; sem cores fixas fora dos tokens.
- A página Pessoal continua como está; a sincronização de férias é a mesma função `employee-folder-sync` no modo férias.
- Validação: `bunx tsgo --noEmit` e build.
