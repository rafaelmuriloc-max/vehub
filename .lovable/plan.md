# Notas de serviço emitidas no limite do MEI

## O que muda
- O faturamento do limite MEI passa a somar também as **NFS-e emitidas** pela empresa (não canceladas), além das NF-e de saída e NFC-e.
- Vale na barra de limite de cada empresa em Guias e Pagamentos, no cartão "Em alerta / excedidas", no detalhe "Ver meses e notas" (as notas de serviço aparecem como "NFS-e") e na barra de limite MEI do portal do cliente.
- O aviso abaixo dos cartões passa a dizer: "Limite calculado pelas NF-e de saída, NFC-e e NFS-e emitidas não canceladas".
- NFS-e tomadas (serviços contratados) continuam fora.

## Detalhes técnicos
- `src/components/mei/MeiLimitTab.tsx` (`useMeiLimits`): buscar também `invoices` (`issue_date`, `gross_value`, `invoice_number`, `status`, `issuer_cnpj`) por `client_id` no ano, mantendo só as com `issuer_cnpj` = CNPJ da empresa (só dígitos) e status sem "cancel"; mapear `gross_value` → `total_value`, tipo `'NFS-e'`.
- Portal (`Portal.tsx`): somar ao `totalAno` do bloco MEI as NFS-e emitidas via `portal_nfse` (direction `saida`, não canceladas) do ano.
- Teste em `src/lib/meiLimit.test.ts`: `somarPorMes` somando NF-e + NFS-e no mesmo mês.
