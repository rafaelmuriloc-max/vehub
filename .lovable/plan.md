

# Corrigir classificação automática de segmentos em branco

## Problema
A classificação automática usa `localStorage` com chave diária (`batch_classify_done_YYYY-MM-DD`). Se já rodou hoje (mesmo que algumas falharam ou novos clientes foram adicionados), não roda novamente. Além disso, erros silenciosos no `catch` podem ter impedido a classificação de alguns clientes.

## Mudanças em `src/pages/Clients.tsx`

### 1. Melhorar controle de re-execução
- Em vez de marcar como "done" mesmo quando alguns falharam, só marcar como done se **todos** foram classificados com sucesso (ou se não há mais pendentes)
- Guardar no localStorage o número de pendentes restantes; se ainda houver pendentes, rodar novamente

### 2. Adicionar retry para falhas
- Se `classifyByAI` falhar para um cliente, não contar como "feito" -- permitir que a próxima execução tente novamente
- Mudar a lógica: só setar localStorage se `toClassify.length === classified`

### 3. Filtro de query mais robusto
- A query atual `business_classification.eq.` (string vazia) pode não pegar todos os casos
- Adicionar também filtro para strings com apenas espaços: usar `business_classification.eq. ` ou tratar no filtro JS

### Mudança concreta (linha ~361):
```
// ANTES: sempre marca como done
localStorage.setItem(CLASSIFY_KEY, 'true');

// DEPOIS: só marca se não sobrou nenhum pendente
if (classified === toClassify.length) {
  localStorage.setItem(CLASSIFY_KEY, 'true');
}
```

Isso garante que ao recarregar a página, a classificação rode novamente para os que falharam.

## Detalhes técnicos
- Apenas `src/pages/Clients.tsx` é modificado
- Sem mudanças no banco de dados ou edge functions

