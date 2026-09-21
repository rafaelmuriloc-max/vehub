# Sincronizar funcionários por arquivo .csv

Hoje a sincronização só lê conteúdo de PDF. Um arquivo .csv na pasta é baixado, fica sem texto e acaba em "Aguardando revisão".

## O que muda

1. Arquivos `.csv` (e `.txt` separado por ponto e vírgula/vírgula/tabulação) passam a ser lidos como planilha de funcionários.
2. O sistema reconhece as colunas pelo cabeçalho, aceitando variações de nome:
   - Nome: `nome`, `funcionario`, `colaborador`, `nome completo`
   - CPF: `cpf`
   - Cargo: `cargo`, `funcao`, `ocupacao`
   - Admissão: `admissao`, `data de admissao`, `entrada`
   - Salário: `salario`, `remuneracao`, `vencimento`
   - Rescisão: `demissao`, `rescisao`, `desligamento`, `saida`
   - Empresa (opcional, por linha): `cnpj`, `empresa`, `codigo`, `sci`
3. Se o cabeçalho não for reconhecido, o conteúdo do .csv é enviado à leitura automática (mesma IA já usada nos PDFs), em vez de falhar.
4. A empresa continua sendo identificada pelo CNPJ, código do escritório ou razão social no nome do arquivo/pasta; quando o .csv tiver coluna de empresa, cada linha pode ir para a empresa correspondente.
5. Cadastro e atualização seguem a regra atual: cria quem não existe, completa só campos vazios, nunca sobrescreve o que foi digitado e nunca exclui ninguém.
6. Datas aceitas em `DD/MM/AAAA` e `AAAA-MM-DD`; salário aceita `1.234,56` e `1234.56`.
7. Linhas sem nome e sem CPF são ignoradas e contadas no resumo da sincronização.

Como .csv não exige leitura pesada de PDF, vários arquivos desse tipo podem ser processados na mesma execução.

## Detalhes técnicos

- `supabase/functions/employee-folder-sync/index.ts`:
  - novo ramo por tipo: `isCsv` (`text/csv`, `text/plain`, extensão `.csv`/`.txt`) decodifica os bytes em UTF-8 com fallback latin1 (detecta caracteres inválidos) e remove BOM.
  - parser CSV próprio: detecção do delimitador pela primeira linha (`;`, `,`, `\t`), suporte a campos entre aspas com aspas duplicadas e quebras de linha internas.
  - `mapCsvHeaders` normaliza cabeçalhos (NFD, minúsculas) e casa com os apelidos acima; sem correspondência mínima (nome ou CPF) cai no caminho da IA com o texto do arquivo.
  - `parseBrDate` e `parseBrMoney` para datas e valores; `termination_date` preenchido define `status: terminated`.
  - identificação da empresa por linha, quando houver coluna de empresa, reaproveitando `clientsByCnpj`, `clientsBySci` e o casamento por razão social.
  - o limite de arquivos por execução e o orçamento de tempo passam a valer só para PDFs; .csv não consome essa cota.
  - `stats` ganha `linhas_ignoradas`, exibido no resumo.
- `src/pages/Personnel.tsx`: o toast da sincronização passa a mostrar as linhas ignoradas quando houver.
- Sem alteração de banco de dados.
- Validação: `bunx tsgo --noEmit`, build limpo e uma sincronização real com um .csv de exemplo.
