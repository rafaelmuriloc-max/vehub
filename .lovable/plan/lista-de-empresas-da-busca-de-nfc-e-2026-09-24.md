# Lista de empresas da busca de NFC-e

## Resultado da última busca (hoje, 16:01)
- 88 empresas aceitas pela SEFAZ-SC: o contador é reconhecido como contabilista, mas nenhuma NFC-e foi encontrada nos últimos 90 dias. É provável que muitas não emitam NFC-e. Por regra da SEFAZ, a próxima busca delas fica liberada daqui a 12 horas.
- 113 empresas recusadas com o e-CPF do contador e com o e-CNPJ do escritório (cStat 8002 — o escritório não aparece como contabilista no SAT).

## O que vou entregar
Uma planilha Excel para download, com duas abas:
1. **Recusadas (sem vínculo no SAT)**: nome da empresa, CNPJ (XX.XXX.XXX/XXXX-XX), situação e código SCI.
2. **Aceitas sem notas**: mesmas colunas, mais o horário em que a próxima busca fica liberada.

As duas abas vêm em ordem alfabética. Nada é alterado no sistema nem no banco de dados.

## Detalhes técnicos
- CNPJs retirados dos registros da função `nfce-query` desta tarde. Recusada = tentou o e-CNPJ do escritório e não recebeu 117. Aceita = recebeu 117.
- Nome, código SCI e situação vêm da tabela `clients`, cruzando pelo CNPJ sem pontuação. `nfce_next_query_at` entra na aba "Aceitas".
- Arquivo gerado em `/mnt/documents/nfce_vinculo_sat.xlsx` com xlsxwriter.
