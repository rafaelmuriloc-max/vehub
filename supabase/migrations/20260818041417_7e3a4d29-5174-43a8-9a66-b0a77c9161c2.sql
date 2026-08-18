UPDATE public.sitfis_results
SET status = 'sem_procuracao',
    error_message = 'Procuração eletrônica ausente ou vencida no e-CAC'
WHERE status = 'error'
  AND error_message ILIKE '%procurador%';

DELETE FROM public.integra_contador_cache WHERE cache_key LIKE 'sitfis_contexto:%';