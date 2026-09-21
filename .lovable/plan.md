# Vencimento dos contratos de experiência

A lista de funcionários passa a mostrar os dois prazos de experiência, lidos automaticamente do relatório "Previsão contrato de experiencia.html" salvo na pasta sincronizada do Drive.

## Novas colunas na lista de funcionários

- **Prazo 1** — data do primeiro vencimento da experiência
- **Dias** — dias do primeiro período, e ao lado quantos dias faltam (ex.: `45 d · faltam 7`)
- **Prazo 2** — data do vencimento da prorrogação
- **Dias** — dias do segundo período, com os dias que faltam

Cores de alerta: vermelho quando já venceu, laranja quando faltam 7 dias ou menos, normal nos demais. Sem informação, mostra "—". Nas telas menores as colunas ficam ocultas, como as demais colunas secundárias.

Um card novo no topo mostra **Experiências a vencer em 15 dias**, para você ver rapidamente se há prazo próximo.

## Como o relatório é lido

1. Na sincronização, qualquer arquivo HTML cujo conteúdo seja o relatório de previsão de contrato de experiência é reconhecido sozinho (não depende do nome exato do arquivo).
2. A leitura é estrutural, sem IA, igual à do relatório de registro de colaboradores.
3. De cada linha são lidos: empresa (CNPJ ou código), nome do funcionário, CPF quando houver, admissão, data e dias do primeiro prazo e data e dias do segundo prazo.
4. O funcionário é localizado na empresa pelo CPF e, sem CPF, pelo nome. Funcionário que ainda não existe no cadastro é criado com esses dados.
5. Datas de experiência são sempre atualizadas quando o relatório trouxer valor diferente — este é o dado que o relatório governa. Os demais campos continuam intocados, conforme a regra atual.
6. Linha sem empresa ou sem pessoa identificada é contada no resumo e não é gravada em empresa errada.
7. O resumo da sincronização passa a informar quantos contratos de experiência foram atualizados.

## Validação pendente

O arquivo "Previsão contrato de experiencia.html" não chegou aqui — a mensagem veio sem anexo. Vou implementar seguindo o mesmo formato FastReport do SCI (rótulos numa linha, valores na linha seguinte), mas preciso do arquivo real para confirmar os rótulos e conferir linha a linha. Anexe o `.html` e eu ajusto o leitor e comparo os totais com o que foi gravado.

## Detalhes técnicos

- Migração: `client_employees` ganha `trial_end_1 date`, `trial_days_1 int`, `trial_end_2 date`, `trial_days_2 int` (nullable, sem default). Sem novos GRANTs/policies — a tabela já os tem.
- Novo `supabase/functions/employee-folder-sync/sciTrial.ts`: `looksLikeTrialHtml(text)` (título "previsão"/"contrato de experiência" normalizado) e `parseTrialHtml(html)` reaproveitando `htmlToRows`/`alignRows`/`norm`/`parseDate` de `sciHtml.ts` (exportar o que faltar). Rótulos aceitos: `empresa`/`empregador`/`cnpj`/`codigo`, `nome`/`trabalhador`/`colaborador`, `cpf`, `admissao`, `1 prazo`/`prazo 1`/`vencimento 1`/`termino 1`, `dias`, `2 prazo`/`prazo 2`/`prorrogacao`. Quando o relatório for uma grade (uma linha por funcionário), o cabeçalho é detectado e as linhas seguintes são mapeadas por coluna; quando for ficha, vale o casamento rótulo/valor por `colspan`.
- `index.ts`: antes do ramo `parseSciHtml`, testar `looksLikeTrialHtml`; o resultado alimenta `ParsedEmployee` com os quatro campos novos e `hasCompanyColumn = true` (nunca empresa padrão). No upsert, criar quando não existir; quando existir, atualizar apenas os campos de experiência (além da regra de rescisão já vigente). `stats.experiencias_atualizadas`.
- `src/pages/Personnel.tsx`: tipo `Employee` com os quatro campos; quatro `TableHead`/`TableCell` (`hidden lg:table-cell`) entre Admissão e Rescisão; helper de dias restantes com `localDateKey`/fuso São Paulo; card "Experiências a vencer em 15 dias"; toast incluindo `experiencias_atualizadas`. Diálogo de edição manual ganha os quatro campos.
- Validação: teste do parser contra o HTML real, `deno test` do novo parser, `bunx tsgo --noEmit`, build limpo, deploy e uma sincronização real com conferência por empresa.
