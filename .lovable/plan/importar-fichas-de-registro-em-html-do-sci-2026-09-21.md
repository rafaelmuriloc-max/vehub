# Importar fichas de registro em HTML do SCI

Hoje a sincronização lê PDF (com leitura automática por IA) e planilhas .csv. Relatórios HTML exportados pelo SCI caem na leitura por IA ou ficam em "Aguardando revisão".

## O que muda

1. Arquivos `.html`/`.htm` (inclusive `.xls` que na verdade é HTML, como o SCI costuma exportar) passam a ser reconhecidos automaticamente.
2. A leitura é feita pela estrutura do documento, não por IA: cada ficha é localizada pelo título **REGISTRO DE COLABORADORES** e pela tabela correspondente.
3. De cada ficha são extraídos: razão social, CNPJ, nome do funcionário, código, contrato, admissão, função, salário inicial, forma de pagamento e data de rescisão — sempre localizando o campo pelo rótulo, e não por posição fixa.
4. A empresa de cada funcionário vem do **CNPJ da própria ficha**. Não existe empresa padrão para o arquivo: se o CNPJ da ficha não corresponder a nenhuma empresa cadastrada, aquele funcionário não é gravado.
5. Cadastro e atualização seguem a regra atual: cria quem não existe, completa o que estiver vazio, nunca sobrescreve o que foi digitado à mão, nunca exclui ninguém.
6. Fichas incompletas (sem nome e sem CPF/código) ou com empresa não identificada ficam contadas e o arquivo aparece em "Aguardando revisão" com o motivo.
7. O resumo da sincronização passa a mostrar: fichas encontradas, funcionários lidos, empresas identificadas, cadastrados, atualizados e fichas sem empresa.
8. Como a leitura de HTML é leve (sem IA), vários arquivos desse tipo podem ser processados na mesma execução, igual ao .csv.

Os formatos já suportados continuam funcionando — o sistema escolhe sozinho a forma de leitura de cada arquivo.

## Validação

Preciso do **arquivo HTML original** para conferir ficha a ficha. Ele foi citado na mensagem, mas só o texto do pedido chegou aqui. Envie o `.html` exportado do SCI e eu comparo a quantidade de fichas do documento com os funcionários gravados em cada empresa, informando qualquer divergência.

## Detalhes técnicos

- `supabase/functions/employee-folder-sync/index.ts`:
  - novo ramo `isHtmlFile` (`text/html`, extensão `.html`/`.htm`, ou conteúdo iniciando com `<html`/`<table` mesmo com mime de Excel), decodificando bytes em UTF-8 com fallback latin1 (reaproveita `decodeBytes`).
  - `parseSciHtml(text)`: usa `deno-dom` (`npm:deno-dom`) para montar o DOM; localiza os nós de tabela cujo texto contém `REGISTRO DE COLABORADORES`; para cada ficha, varre as células e casa rótulos normalizados (NFD, minúsculas, sem pontuação) — `razao social`/`empregador`, `cnpj`, `nome`/`colaborador`, `codigo`, `contrato`, `admissao`, `funcao`/`cargo`, `salario`, `forma de pagamento`, `rescisao`/`demissao` — pegando o valor da célula seguinte ou do texto após o rótulo (`RÓTULO: valor`) na mesma célula.
  - reaproveita `normalizeDate`/`parseBrDate` e `normalizeSalary`/`parseBrMoney`; `termination_date` preenchido e no passado define `status: terminated`.
  - devolve `ParsedEmployee[]` já com `company_document` (CNPJ da ficha) preenchido e `hasCompanyColumn = true`, de modo que o loop atual resolve a empresa por linha e nunca aplica a empresa do arquivo (mesma trava criada para .csv).
  - HTML não consome a cota de `MAX_FILES_PER_RUN`/`TIME_BUDGET_MS` (hoje válida só para PDF).
  - `stats` ganha `fichas_html` (fichas detectadas) e reutiliza `linhas_sem_empresa`/`empresas_atendidas`; log por arquivo com fichas encontradas, empresas distintas e funcionários por empresa, para a etapa de conferência.
  - fallback: se o HTML não contiver nenhuma ficha reconhecível, o texto visível é enviado ao caminho atual de IA, preservando o comportamento anterior.
- `src/pages/Personnel.tsx`: toast da sincronização exibe fichas encontradas, empresas atendidas e fichas sem empresa.
- Sem alteração de banco de dados.
- Validação: `bunx tsgo --noEmit`, build limpo e uma sincronização real com o HTML do SCI, conferindo empresa por empresa.
