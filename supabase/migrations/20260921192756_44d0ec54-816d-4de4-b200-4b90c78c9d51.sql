DELETE FROM public.employee_documents d
WHERE d.file_name ILIKE '%experi%'
  AND d.employee_id IN (
    SELECT e.id FROM public.client_employees e
    WHERE e.source = 'drive'
      AND e.created_at >= '2026-09-21 19:22:00+00'
      AND e.created_at <= '2026-09-21 19:25:00+00'
  );

DELETE FROM public.client_employees e
WHERE e.source = 'drive'
  AND e.created_at >= '2026-09-21 19:22:00+00'
  AND e.created_at <= '2026-09-21 19:25:00+00';