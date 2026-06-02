## Plano: CRUD da instância da Evolution API (aba WhatsApp)

Operar **apenas na instância configurada** em `EVOLUTION_INSTANCE_NAME`, sem listar nada do servidor (a conta tem outras instâncias que não pertencem a este projeto). Sem nova tabela.

### Ações disponíveis no card

Reorganizar `EvolutionConnectionCard.tsx` em duas linhas claras, todas operando sobre a instância única do secret:

1. **Status atual** — badge (Conectado / Conectando / Desconectado / Instância inexistente) + nome da instância em mono.
2. **Ações operacionais** (visíveis sempre):
   - **Gerar QR Code** — abre `EvolutionQrDialog` (já existe).
   - **Reiniciar** — `evolution-restart` (já existe).
   - **Desconectar** — `evolution-logout` (já existe).
   - **Atualizar status** — `evolution-connection-state` (já existe).
3. **Zona de manutenção** (já existe, mantida):
   - **Criar instância** — `evolution-instance-create`. Habilitado quando `notFound` ou `state === 'close'`. Após sucesso abre o QR automaticamente.
   - **Excluir instância** — `evolution-instance-delete` (confirm destrutivo).

Nenhuma listagem é chamada. Nenhum endpoint `fetchInstances` é consumido.

### Edge functions

Tudo já está implementado e usa `EVOLUTION_INSTANCE_NAME` direto do secret:
- `evolution-connection-state`
- `evolution-connect` (QR)
- `evolution-logout`
- `evolution-restart`
- `evolution-instance-create`
- `evolution-instance-delete`

Nenhuma nova edge function. Nenhuma alteração no `supabase/config.toml`.

### Ajustes de UI em `EvolutionConnectionCard.tsx`

- Exibir o **nome da instância** (carregado de uma nova função utilitária trivial ou hardcoded a partir do retorno do `evolution-connection-state` — adicionar `instanceName` ao payload retornado).
- Pequeno ajuste em `evolution-connection-state`: incluir `instanceName: Deno.env.get("EVOLUTION_INSTANCE_NAME")` na resposta para o card exibir.
- Reorganizar os botões em duas seções com `<Separator />`: "Operação" e "Zona de manutenção" (já parcialmente feito).
- Adicionar `<AlertDialog>` (no lugar do `confirm` nativo) para Excluir e Desconectar, para deixar a ação destrutiva mais clara.

### Arquivos afetados
- `src/components/settings/EvolutionConnectionCard.tsx` (reorganização e AlertDialog)
- `supabase/functions/evolution-connection-state/index.ts` (incluir `instanceName` no payload)

### Fora de escopo
- Listar instâncias do servidor Evolution.
- Múltiplas instâncias / roteamento por departamento.
- Persistir credenciais no banco.
