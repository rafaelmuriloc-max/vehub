INSERT INTO public.obligation_activity_completions (instance_id, activity_id, completed, completed_at)
SELECT '7a2d971c-00c3-41cc-9a9e-66ea790884e8'::uuid, 'd8a587d7-e88a-41ef-8513-c120f0227b0e'::uuid, true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.obligation_activity_completions
  WHERE instance_id = '7a2d971c-00c3-41cc-9a9e-66ea790884e8'::uuid
    AND activity_id = 'd8a587d7-e88a-41ef-8513-c120f0227b0e'::uuid
);

UPDATE public.obligation_activity_completions
SET completed = true, completed_at = COALESCE(completed_at, now())
WHERE instance_id = '7a2d971c-00c3-41cc-9a9e-66ea790884e8'::uuid
  AND activity_id = 'd8a587d7-e88a-41ef-8513-c120f0227b0e'::uuid
  AND completed = false;