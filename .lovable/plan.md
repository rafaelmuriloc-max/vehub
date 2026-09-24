# Correção: NFC-e rejeitada pela SEFAZ-SC (cStat 8002)

## O que o log mostra
Todas as empresas consultadas voltaram com:
`cStat=8002 Rejeição: Requisitante não é Contabilista do CNPJ/CPF informado.`

Causa: a busca de NFC-e está assinando com o **certificado da própria empresa cliente**. Esse serviço da SEFAZ-SC só aceita quem está cadastrado no SAT como **contabilista responsável** da empresa. Nenhuma nota foi baixada, nada foi gravado errado.

## O que vou mudar
1. A busca de NFC-e passa a usar o certificado do escritório cadastrado em Administração:
   - primeiro o **e-CPF do contador** (o mesmo usado no SERPRO);
   - se ele for recusado com 8002, tenta o **e-CNPJ da Velocitä**.
2. Quando a SEFAZ responder 8002 com os dois, a empresa fica marcada como "escritório não é contabilista desta empresa no SAT" — sem ativar a trava de 12h e sem mexer no ponto de leitura.
3. Na tela NFC-e, o aviso após Sincronizar lista essas empresas pelo nome, para você conferir o vínculo no SAT.

## Atenção
Se o contador/escritório realmente não estiver vinculado a alguma empresa no SAT da SEF-SC, essa empresa continuará recusada até o vínculo ser feito lá.

## Detalhes técnicos
- `supabase/functions/nfce-query/index.ts`: carregar `accountant_certificate_url/password` e `digital_certificate_url/password` da tabela de dados do escritório (mesma consulta usada em `integra-contador`), montar lista de certificados candidatos, repetir a chamada SOAP com o próximo em caso de cStat 8002; retornar `{ not_accountant: true }` sem gravar `nfce_next_query_at`.
- `nfe-nfse-daily-sync`: registrar `nfce = "sem_vinculo_sat"`.
- `src/components/invoices/NfceTab.tsx`: agrupar `not_accountant` no toast final.
- Deploy de `nfce-query` e `nfe-nfse-daily-sync`.
