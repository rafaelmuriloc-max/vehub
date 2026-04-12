
# Ajustar SITFIS para montar a 2ª etapa com o protocolo e o mesmo contexto da 1ª

## Problema identificado

Hoje o fluxo automático do SITFIS ainda depende de duas coisas frágeis:

1. A etapa 1 (`SOLICITARPROTOCOLO91`) retorna `304` com body vazio em vários casos
2. A etapa 2 (`RELATORIOSITFIS92`) é montada pelo fluxo genérico da Edge Function, recalculando `autorPedidoDados`, `contribuinte` e `versaoSistema` a partir do cliente selecionado

Pelo body que você enviou, a etapa 2 precisa reutilizar o contexto correto da etapa 1 e enviar o protocolo dentro de `pedidoDados.dados` exatamente no formato esperado.

## Solução

### 1. Normalizar a resposta da etapa 1 na Edge Function
Em `supabase/functions/integra-contador/index.ts`:

- Para `SOLICITARPROTOCOLO91`, extrair e normalizar:
  - `protocoloRelatorio`
  - `contratante`
  - `autorPedidoDados`
  - `contribuinte`
  - `versaoSistema`
- Salvar isso no cache existente (`integra_contador_cache`) como JSON, não só a string do protocolo
- Quando vier `304`, devolver esse contexto normalizado do cache para o frontend

Assim a etapa 2 não precisa “adivinhar” nada.

### 2. Montar a etapa 2 com body específico de SITFIS
Ainda em `supabase/functions/integra-contador/index.ts`:

- Criar um tratamento específico para `RELATORIOSITFIS92`
- Em vez de usar o builder genérico, montar o body final usando:
  - o mesmo `contratante`
  - o mesmo `autorPedidoDados`
  - o mesmo `contribuinte`
  - a `versaoSistema` correta dessa etapa
  - `pedidoDados.dados` = `JSON.stringify({ protocoloRelatorio })`

Em outras palavras, a chamada final passará a seguir este formato lógico:

```json
{
  "contratante": { ... },
  "autorPedidoDados": { ... },
  "contribuinte": { ... },
  "pedidoDados": {
    "idSistema": "SITFIS",
    "idServico": "RELATORIOSITFIS92",
    "versaoSistema": "...",
    "dados": "{ \"protocoloRelatorio\": \"...\" }"
  }
}
```

### 3. Simplificar o frontend
Em `src/pages/IntegraContador.tsx`:

- A etapa 1 vai ler um campo normalizado único retornado pela Edge Function
- A etapa 2 vai enviar para a função apenas o protocolo e, se necessário, o contexto SITFIS normalizado
- Remover a extração frágil em vários caminhos (`step1.data.data.dados`, `step1.data.dados`, etc.)

Isso deixa o frontend mais simples e tira a responsabilidade de montar o body correto do navegador.

## Ajuste importante de regra
Para SITFIS, a etapa 2 não deve recalcular `autorPedidoDados` e `contribuinte` apenas com base em `client.document`. Ela deve reutilizar exatamente o contexto válido da etapa anterior/cache, porque é isso que garante o body compatível com o protocolo retornado.

## Arquivos
| Arquivo | Mudança |
|---|---|
| `supabase/functions/integra-contador/index.ts` | Normalizar etapa 1, salvar contexto completo no cache e montar body específico da etapa 2 |
| `src/pages/IntegraContador.tsx` | Simplificar fluxo de 2 etapas para consumir resposta normalizada |
| Sem nova migração | A tabela `integra_contador_cache` já existe e o `cache_value` pode armazenar JSON |

## Detalhe técnico
Vou manter a versão (`versaoSistema`) configurada por etapa, em vez de deixar isso implícito no fluxo genérico. Assim a etapa 1 e a etapa 2 podem usar exatamente a versão exigida pelo SITFIS, sem mistura entre elas.
