CREATE SEQUENCE IF NOT EXISTS public.tasks_task_number_seq;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_number BIGINT;
UPDATE public.tasks t SET task_number = s.rn
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn FROM public.tasks WHERE task_number IS NULL) s
WHERE t.id = s.id AND t.task_number IS NULL;
SELECT setval('public.tasks_task_number_seq', COALESCE((SELECT MAX(task_number) FROM public.tasks), 0) + 1, false);
ALTER TABLE public.tasks ALTER COLUMN task_number SET DEFAULT nextval('public.tasks_task_number_seq');
ALTER TABLE public.tasks ALTER COLUMN task_number SET NOT NULL;
ALTER SEQUENCE public.tasks_task_number_seq OWNED BY public.tasks.task_number;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_task_number_key ON public.tasks(task_number);