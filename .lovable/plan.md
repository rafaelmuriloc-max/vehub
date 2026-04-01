

# Forçar disparo de atividades pendentes (one-time script)

## Contexto
15 instâncias da obrigação "Folha Pró Labore" (referência abril/2026) têm documentos completos mas as 3 atividades auto_start (WhatsApp 1, WhatsApp 2 com docs, E-mail) nunca foram disparadas.

## Solução
Executar um script Python one-time que, para cada uma das 15 instâncias:

1. **WhatsApp 1** (order 3) — template `send_output_informations_template_3_header` sem document header
2. **WhatsApp 2** (order 4) — template `envio_doc` com document header (envia cada documento anexado separadamente)
3. **E-mail** (order 5) — via SMTP do Depto Pessoal com anexos

O script chamará as edge functions `whatsapp-send` e `smtp-send` diretamente via HTTP, usando o token do usuário logado (passado como parâmetro ou via env). Após cada envio bem-sucedido, insere o registro de completion na tabela `obligation_activity_completions`.

## Dados já mapeados
- **Obligation ID**: `8232b5f4-b984-4d39-abef-730debde6321`
- **Activity IDs**: WhatsApp 1 = `af78b123-...`, WhatsApp 2 = `698239f8-...`, Email = `eda9da43-...`
- **Department**: Pessoal (`af36437e-da3d-4c6e-bd71-e6584fa96843`)
- **15 instâncias** com seus `instance_id` e `client_id`
- Competência: março/2026 (previous rule), vencimento dia 5

## Execução
- Script Python usando `requests` + Supabase REST API
- Busca contatos por departamento para cada cliente
- Gera signed URLs para documentos
- Chama edge functions sequencialmente com delay entre clientes
- Insere email_logs e completions via REST API

## Arquivos
- Nenhuma alteração de código — script one-time via `code--exec`

