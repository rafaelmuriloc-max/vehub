Mover o formulário PGDAS-D (Entregar Declaração Mensal) do Integra Contador para um botão por empresa na aba **Simples Nacional**.

## Mudanças

### 1. `src/components/simples-nacional/SimplesNacionalTab.tsx`
- Adicionar botão **"Gerar Declaração Mensal"** (ícone `FileText`) na linha de cabeçalho expandido de cada empresa, ao lado de "Atualizar esta empresa".
- Ao clicar, abrir um `Dialog` (full-width / scrollable) renderizando `PgdasdDeclaracaoForm` com o CNPJ do cliente.
- Ao submeter, invocar a edge function `integra-contador` com `idSistema: 'PGDASD'`, `idServico: 'TRANSDECLARACAO11'`, `tipo: 'Declarar'` e `dados` (JSON string vindo do form).
- Mostrar toast de sucesso/erro e fechar o dialog em caso de sucesso, então `loadData()`.

### 2. `src/pages/IntegraContador.tsx`
- Remover o serviço `TRANSDECLARACAO11` (linha 88) do `SERVICE_CATALOG.sn.services`.
- Pode manter o import de `PgdasdDeclaracaoForm` se ainda for usado em outro lugar; caso contrário, remover.

### 3. Sem alterações de banco, edge function ou outros serviços

O fluxo de envio (procurador, mTLS, payload do PGDAS-D) continua o mesmo — apenas a UI muda de lugar.