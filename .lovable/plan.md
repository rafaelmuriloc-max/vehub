# Por que algumas empresas dão erro na Situação Fiscal

## O que os dados mostram

Contagem atual dos registros com status `error` em `sitfis_results`:

```text
11  Não foi possível obter autorização de procurador junto ao SERPRO
 5  Relatório não ficou pronto a tempo. Reconsulte este cliente.
 4  Consulta incompleta - reconsultar   (marcados na correção anterior)
 2  Erro ao solicitar protocolo
 1  Address endpoint ... [State: SUSPENDED]  (indisponibilidade do gateway SERPRO)
```

E nos logs da função `integra-contador` aparece o padrão: protocolo obtido (200) → Emitir devolve 204 / 202 → depois 500 `[Erro-Sitfis-ER05] Erro ao processar a requisição. Inicie uma nova solicitação /apoiar.`

## Causas, uma a uma

1. Sem procuração eletrônica (11 empresas) — maior grupo.
   O escritório não tem procuração ativa no e-CAC para esses CNPJs (ou está vencida/sem o serviço SITFIS marcado). Não é falha do sistema: sem o token de procurador a Receita bloqueia a consulta. Solução é regularizar a procuração; o sistema deve apenas identificar e sinalizar isso de forma clara, separado de "erro".

2. Protocolo expirado durante a espera (5 + parte dos 204/202).
   O relatório é assíncrono: pede-se o protocolo em `/Apoiar` e emite-se em `/Emitir`. Hoje, quando o SERPRO responde "em processamento", repetimos apenas o `Emitir` com o mesmo protocolo. Quando esse protocolo caduca, o SERPRO responde ER05 pedindo explicitamente uma nova solicitação em `/apoiar` — e nós continuamos insistindo até estourar as tentativas.

3. Protocolo em cache reaproveitado.
   O contexto do SITFIS fica em cache por 24 h. Um protocolo antigo reutilizado no dia seguinte também cai no ER05.

4. Indisponibilidade do gateway SERPRO (1) — transitório, só reconsultar.

## O que fazer

1. Novo status "sem procuração"
   - Quando a falha for de token de procurador, gravar status próprio (não `error`), com mensagem "Procuração eletrônica ausente ou vencida no e-CAC".
   - Card e filtro próprios no painel, para separar problema cadastral de falha técnica.

2. Reiniciar o fluxo quando o protocolo caducar
   - Ao receber ER05 (ou 500 na etapa Emitir), descartar o protocolo, apagar o cache do cliente e refazer `/Apoiar` para obter um protocolo novo, repetindo o ciclo até 2 vezes antes de desistir.

3. Reduzir o tempo de vida do cache do protocolo
   - Cachear o contexto SITFIS por poucos minutos (não 24 h), evitando reuso de protocolo morto.

4. Tratar 202/204 explicitamente
   - Respeitar o `tempoEspera` devolvido; se vier 204 sem corpo, aguardar e repetir; nunca classificar como Regular sem PDF (já garantido).

5. Mensagens de erro úteis na tabela
   - Exibir a causa resumida por cliente ("sem procuração", "relatório não ficou pronto", "SERPRO indisponível") e manter o botão de reconsulta individual.

## Detalhes técnicos

- `src/components/integra-contador/SituacaoFiscalTab.tsx`: envolver as etapas 1 e 2 num laço externo (`maxCiclos = 2`); detectar `Erro-Sitfis-ER05` / status 500 na etapa Emitir e reiniciar do `SOLICITARPROTOCOLO91`.
- `supabase/functions/integra-contador/index.ts`: reduzir `expires_at` do `integra_contador_cache` para ~10 min nas chaves `sitfis_contexto:*`; invalidar a chave quando a etapa Emitir retornar ER05; devolver ao frontend um campo `error_kind` (`procuracao`, `protocolo_expirado`, `gateway`, `processando`).
- `sitfis_results`: usar `status = 'sem_procuracao'` para o grupo 1 e reclassificar os 11 registros atuais.
- `SitfisOverviewPanel.tsx`: incluir a nova categoria nos cards e no donut "Situação Geral".
