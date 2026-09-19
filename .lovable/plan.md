# Painel estruturado de pendências fiscais

## Objetivo

Substituir os blocos de texto bruto da Situação Fiscal por uma área de gestão clara e responsiva. A tela continuará usando os clientes, resultados, PDFs, consulta individual/em lote, seleção, paginação e downloads existentes; não haverá alteração de banco, integração SERPRO ou dados gravados.

## Nova organização da tela

- Manter o cabeçalho, ações em lote e visão consolidada, ajustando os indicadores para refletirem as ocorrências estruturadas.
- Criar uma barra de filtros com:
  - busca por razão social, código SCI ou CNPJ;
  - empresa;
  - tipo de ocorrência;
  - situação fiscal;
  - órgão responsável;
  - competência (mês/ano);
  - regime tributário já existente.
- Trocar a tabela principal por uma listagem paginada de cards expansíveis, um por empresa.
- Resumo fechado de cada empresa: seleção, código SCI e nome, CNPJ formatado, data/hora da consulta, situação fiscal, total real de ocorrências e badges dos tipos identificados.
- Ações visíveis: **Ver detalhes**, **Baixar relatório original** e a consulta individual já existente.
- Manter seleção em lote, consulta em lote, ZIP de relatórios e opções de 10/20/50/100/Todos.

## Conteúdo estruturado por empresa

Ao expandir um card, mostrar seções independentes com contadores e estados vazios:

1. **Declarações omitidas**
   - Tipo da declaração e motivo, quando identificáveis.
   - Para DCTFWeb, competências agrupadas por ano, com meses em badges e expansão para visualizar todos os períodos.
   - Uma omissão continua sendo omissão mesmo quando o relatório também menciona parcelamento.

2. **Débitos tributários**
   - Tributo, competência, valor principal, valor atualizado, vencimento, órgão e situação.
   - Cada campo não reconhecido com segurança mostra **Informação não disponível**.

3. **Parcelamentos**
   - Modalidade, número, situação, saldo e órgão, somente quando encontrados no relatório.
   - Parcelamento será categoria informativa própria; sua presença isolada não cria débito ativo e não regulariza omissões.

4. **Processos / exigibilidade suspensa**
   - Identificação, órgão, situação e referência disponível, sem incorporar cabeçalhos ou texto de seções vizinhas.

5. **Situação na PGFN**
   - Resultado da seção PGFN separado do diagnóstico da Receita Federal.
   - Frases como “não foram detectadas pendências” na PGFN não neutralizam ocorrências da Receita.

Cada ocorrência manterá uma referência discreta à página/seção de origem quando ela puder ser determinada com segurança.

## Extração segura do PDF

- Criar um parser dedicado e tipado para transformar o texto do PDF em um modelo de ocorrências fiscais.
- Extrair o texto por página, preservando fronteiras de página e reconstruindo blocos pelos marcadores reais do SITFIS.
- Separar explicitamente Receita Federal e PGFN antes da classificação.
- Remover da apresentação cabeçalhos, rodapés, paginação, identificação repetida do contribuinte e trechos concatenados entre seções.
- Aplicar regras específicas por categoria, sem usar apenas palavras soltas.
- Para DCTFWeb, reconhecer ano e meses abreviados, normalizar as competências e agrupá-las cronologicamente.
- Valores, datas, números e situações só serão preenchidos quando o padrão for inequívoco. Caso contrário: **Informação não disponível**.
- Fazer a extração sob demanda ao expandir/filtrar uma empresa e manter cache em memória, evitando reler todos os PDFs no carregamento inicial.
- O status persistido e os PDFs continuam intactos; a estrutura serve à apresentação e aos filtros da sessão atual.

## Detalhes e relatório original

- **Ver detalhes** abre um painel amplo com a identificação da empresa e as cinco seções estruturadas.
- Ao final, incluir a seção recolhível **Relatório original**, fechada por padrão, com o PDF integral incorporado e alternativas para abrir ou baixar.
- A listagem principal nunca exibirá texto bruto longo do PDF.
- Ausência de PDF ou falha de leitura terá estado claro, sem criar dados substitutos.

## Componentes e arquivos

- `src/components/integra-contador/sitfisParser.ts`: tipos, normalização por página, separação de seções e parsers das cinco categorias.
- `src/components/integra-contador/SitfisCompanyCard.tsx`: resumo e expansão responsiva da empresa.
- `src/components/integra-contador/SitfisDetailPanel.tsx`: detalhamento estruturado e “Relatório original”.
- `src/components/integra-contador/SituacaoFiscalTab.tsx`: filtros, cache, paginação, seleção e integração com as ações atuais.
- `src/components/integra-contador/SitfisOverviewPanel.tsx`: consolidar contagens sem misturar parcelamento, débito, omissão e PGFN.
- Reutilizar Accordion/Collapsible, Dialog ou Sheet, Button, Badge, Select e demais controles já existentes.

## Validação

- Testes unitários do parser com casos de:
  - DCTFWeb com um e vários anos/meses;
  - parcelamento junto de omissão, mantendo categorias independentes;
  - PGFN regular com Receita irregular;
  - débito completo e débito com campos ausentes;
  - cabeçalhos/rodapés repetidos e relatório sem dados confiáveis.
- Verificar filtros combinados, expansão dos cards, paginação, consulta individual/em lote, PDF individual e ZIP.
- Conferir desktop e celular, textos extensos, estados vazios, carregamento e erro.
- Executar testes, verificação de tipos e build.

## Limites deste incremento

- Sem migração, nova tabela, mudança de RLS ou reprocessamento dos registros existentes.
- A qualidade dos campos depende do conteúdo efetivamente presente no PDF; nenhuma informação será inferida ou inventada.
- Os documentos originais permanecem a fonte de verdade e acessíveis em todos os detalhes estruturados.
