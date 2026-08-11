UPDATE public.tasks SET status = 'done' WHERE notify_sent_at IS NOT NULL AND status <> 'done';

ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;