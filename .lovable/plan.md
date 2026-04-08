

# Aplicar backfill do simples_anexo nos 97 clientes

## Plano

1. **Consultar clientes** com `tax_regime = 'simples_nacional'`, `main_activity IS NOT NULL` e `simples_anexo IS NULL`
2. **Classificar cada cliente** chamando a Edge Function `classify-segment` com `classify_anexo: true` e o CNAE principal
3. **Aplicar UPDATE** em cada cliente usando a ferramenta de insert/update do Supabase

## Execução
- Script único que busca os clientes, classifica via IA e atualiza o banco em lote
- Arquivo alterado: nenhum (apenas operação de dados)

