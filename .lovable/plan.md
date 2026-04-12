

# Simplificar fluxo de Situação Fiscal (SITFIS) — 2 etapas em 1

## Problema

O usuário precisa executar manualmente dois serviços: primeiro `SOLICITARPROTOCOLO91` para obter o protocolo, depois copiar o protocolo e usar no `RELATORIOSITFIS92`. Isso deve ser automatizado em uma única ação.

## Solução

Substituir os dois serviços SITFIS por um único serviço "Relatório de Situação Fiscal" sem campos obrigatórios. No `handleSubmit`, quando esse serviço for selecionado, o frontend faz automaticamente:

1. Chama a Edge Function com `SOLICITARPROTOCOLO91` (tipo `Apoiar`) para obter o protocolo
2. Extrai o `protocoloRelatorio` da resposta
3. Chama a Edge Function com `RELATORIOSITFIS92` (tipo `Emitir`) passando o protocolo obtido
4. Exibe o resultado final (relatório)

O usuário verá um loading com mensagem indicando o progresso ("Solicitando protocolo..." → "Emitindo relatório...").

### Mudanças no catálogo (linhas 152-158)

```typescript
situacaofiscal: {
  label: 'Situação Fiscal',
  icon: <Search className="h-4 w-4" />,
  services: [
    { 
      idSistema: 'SITFIS', 
      idServico: 'RELATORIOSITFIS92', 
      label: 'Relatório de Situação Fiscal', 
      description: 'Solicita protocolo e emite relatório automaticamente', 
      tipo: 'Emitir', 
      versaoSistema: '2.0', 
      fields: [] 
    },
  ],
},
```

### Mudança no handleSubmit (após linha 275)

Adicionar lógica especial antes do fluxo padrão:

```typescript
// Se é SITFIS RELATORIOSITFIS92 sem dados preenchidos, 
// fazer o fluxo de 2 etapas automaticamente
if (selectedService.idSistema === 'SITFIS' 
    && selectedService.idServico === 'RELATORIOSITFIS92' 
    && !dadosOverride) {
  // Etapa 1: solicitar protocolo
  setLoadingMessage('Solicitando protocolo...');
  const step1 = await supabase.functions.invoke('integra-contador', {
    body: {
      client_id: selectedClientId,
      idSistema: 'SITFIS',
      idServico: 'SOLICITARPROTOCOLO91',
      tipo: 'Apoiar',
      versaoSistema: '2.0',
      dados: '',
    },
  });
  if (step1.error || !step1.data?.success) throw new Error(step1.data?.error || 'Erro ao solicitar protocolo');
  
  // Extrair protocolo da resposta
  const protocoloRelatorio = /* extrair de step1.data.dados */;
  
  // Etapa 2: emitir relatório
  setLoadingMessage('Emitindo relatório...');
  // Chama com dados = { protocoloRelatorio }
  // ... continua com o fluxo normal
}
```

Também adicionar um state `loadingMessage` para mostrar o progresso ao usuário.

## Arquivo

| Arquivo | Mudança |
|---------|--------|
| `src/pages/IntegraContador.tsx` | Catálogo (remover SOLICITARPROTOCOLO91, ajustar RELATORIOSITFIS92), handleSubmit (lógica de 2 etapas), state `loadingMessage` |

