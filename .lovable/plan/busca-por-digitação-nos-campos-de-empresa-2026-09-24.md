# Busca por digitação nos campos de empresa

## O que muda
Os campos de escolha de empresa que hoje abrem só uma lista passam a ter uma caixa para digitar e filtrar por nome, código SCI ou CNPJ, no mesmo estilo já usado em outras telas do sistema.

Telas afetadas:
- Notas Fiscais → NFC-e (filtro "Empresa")
- Notas Fiscais → NF-e (filtro "Todos os clientes")
- Notas Fiscais → NFS-e (filtro "Todos os clientes")
- Emitir NFS-e (cliente prestador)
- Integra Contador (seleção do cliente)

A opção "Todas as empresas/Todos os clientes" continua como primeiro item onde já existe. Nada muda nas regras de filtragem nem nos dados.

## Detalhes técnicos
- Criar `src/components/ClientCombobox.tsx` (Popover + Command) reutilizável: props `clients`, `value`, `onChange`, `allowAll?`, `allLabel?`, `placeholder?`; rótulo via `formatClientLabel`; busca por label + CNPJ.
- Substituir os `Select` de empresa em `NfceTab.tsx`, `NfeTab.tsx`, `NfseTab.tsx`, `InvoiceEmit.tsx`, `IntegraContador.tsx` pelo novo componente, mantendo o mesmo estado.
- Validação: `bunx tsgo --noEmit` e build OK.
