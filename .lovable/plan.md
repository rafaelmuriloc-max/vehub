O erro `[EntradaIncorreta-REGIME-MSG_ISN_059]` ocorre porque os serviços do sistema `REGIMEAPURACAO` esperam o campo `anoOpcao`, mas o app está enviando `anoCalendario` (chave compartilhada do `F_ANO`).

## Mudança

Em `src/pages/IntegraContador.tsx`:

1. Adicionar um novo descritor de campo:
   ```ts
   const F_ANO_OPCAO = { key: 'anoOpcao', label: 'Ano da Opção', required: true, placeholder: '2026' };
   ```
2. Substituir `F_ANO` por `F_ANO_OPCAO` nas quatro entradas do sistema `REGIMEAPURACAO`:
   - `EFETUAROPCAOREGIME101`
   - `CONSULTARANOSCALENDARIOS102` (mantém `[]`, sem alteração)
   - `CONSULTAROPCAOREGIME103`
   - `CONSULTARRESOLUCAO104`

Os demais serviços (`PGDASD`, `DEFIS`, `PGMEI`, `PAGTOWEB`, etc.) continuam usando `anoCalendario` via `F_ANO`.

Nenhuma alteração em edge function ou backend — apenas a chave enviada no `dados`.