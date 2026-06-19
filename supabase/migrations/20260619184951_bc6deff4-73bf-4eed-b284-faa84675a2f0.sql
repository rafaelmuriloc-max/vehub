-- Cleanup Josilene DAS 05/2026 failed state to allow resend
DELETE FROM public.whatsapp_logs
WHERE instance_id = 'bc67c5f9-c6e3-4e0d-ae3a-dde6b6328363'
  AND status = 'failed';

-- Reset the "Envio DAS" (documents_only) completion marker for that instance
UPDATE public.obligation_activity_completions
   SET completed = false,
       completed_at = NULL,
       failure_reason = 'Reset manual: documento de maio não foi entregue após reanexação',
       last_retry_at = NULL
 WHERE instance_id = 'bc67c5f9-c6e3-4e0d-ae3a-dde6b6328363'
   AND activity_id = '6cbbd025-aee8-4e1a-8f2c-5110341709c5'
   AND file_url IS NULL;