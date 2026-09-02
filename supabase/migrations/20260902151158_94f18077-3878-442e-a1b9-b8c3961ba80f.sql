CREATE SEQUENCE IF NOT EXISTS public.support_ticket_number_seq;

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number bigint NOT NULL DEFAULT nextval('public.support_ticket_number_seq'),
  conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  contact_name text,
  contact_phone text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  assigned_to uuid,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  first_response_at timestamptz,
  wait_seconds integer,
  handle_seconds integer,
  messages_count integer NOT NULL DEFAULT 0,
  subject text,
  summary text,
  category text,
  summary_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.support_ticket_number_seq TO authenticated, service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can insert tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete tickets" ON public.support_tickets
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_support_tickets_conversation ON public.support_tickets(conversation_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_opened_at ON public.support_tickets(opened_at DESC);
CREATE UNIQUE INDEX idx_support_tickets_open_unique ON public.support_tickets(conversation_id) WHERE status = 'open';

CREATE TRIGGER trg_support_tickets_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Abrir chamado ao criar conversa
CREATE OR REPLACE FUNCTION public.trg_ticket_open_on_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'open' THEN
    INSERT INTO public.support_tickets (conversation_id, client_id, contact_name, contact_phone, department_id, assigned_to, opened_at)
    VALUES (NEW.id, NEW.client_id, NEW.name, NEW.whatsapp_phone, NEW.triaged_department_id, NEW.assigned_to, COALESCE(NEW.created_at, now()))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ticket_open_on_conversation
  AFTER INSERT ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_open_on_conversation();

-- Sincronizar / encerrar / reabrir
CREATE OR REPLACE FUNCTION public.trg_ticket_sync_on_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_count int;
  v_first timestamptz;
  fn_url text := 'https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/ticket-summarize';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbWdqanZhcnp6ZnNiZHB0aG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODg3MTQsImV4cCI6MjA4ODA2NDcxNH0.1GiLwH1Xc991wQ1Qg35H5_e94CXNrNFbt7Yyoj14bLo';
BEGIN
  SELECT * INTO v_ticket FROM public.support_tickets
   WHERE conversation_id = NEW.id AND status = 'open'
   ORDER BY opened_at DESC LIMIT 1;

  -- Fechamento
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    IF v_ticket.id IS NOT NULL THEN
      SELECT count(*), min(created_at) INTO v_count, v_first
        FROM public.chat_messages
       WHERE conversation_id = NEW.id AND created_at >= v_ticket.opened_at AND deleted_at IS NULL;

      UPDATE public.support_tickets
         SET status = 'closed',
             closed_at = COALESCE(NEW.closed_at, now()),
             handle_seconds = GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(NEW.closed_at, now()) - opened_at))::int),
             wait_seconds = COALESCE(OLD.total_wait_seconds, 0),
             messages_count = COALESCE(v_count, 0),
             first_response_at = COALESCE(first_response_at, v_first),
             client_id = COALESCE(NEW.client_id, client_id),
             contact_name = COALESCE(NEW.name, contact_name),
             contact_phone = COALESCE(NEW.whatsapp_phone, contact_phone),
             department_id = COALESCE(NEW.triaged_department_id, department_id),
             assigned_to = COALESCE(assigned_to, OLD.assigned_to),
             summary_status = 'pending'
       WHERE id = v_ticket.id;

      BEGIN
        PERFORM net.http_post(
          url := fn_url,
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || anon_key),
          body := jsonb_build_object('ticket_id', v_ticket.id)
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'ticket-summarize dispatch failed: %', SQLERRM;
      END;
    END IF;
    RETURN NEW;
  END IF;

  -- Reabertura -> novo chamado
  IF NEW.status = 'open' AND OLD.status IS DISTINCT FROM 'open' THEN
    IF v_ticket.id IS NULL THEN
      INSERT INTO public.support_tickets (conversation_id, client_id, contact_name, contact_phone, department_id, assigned_to, opened_at)
      VALUES (NEW.id, NEW.client_id, NEW.name, NEW.whatsapp_phone, NEW.triaged_department_id, NEW.assigned_to, now())
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  -- Sincronização do chamado aberto
  IF v_ticket.id IS NOT NULL THEN
    UPDATE public.support_tickets
       SET assigned_to = COALESCE(NEW.assigned_to, assigned_to),
           department_id = COALESCE(NEW.triaged_department_id, department_id),
           client_id = COALESCE(NEW.client_id, client_id),
           contact_name = COALESCE(NEW.name, contact_name),
           contact_phone = COALESCE(NEW.whatsapp_phone, contact_phone)
     WHERE id = v_ticket.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ticket_sync_on_conversation
  AFTER UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_sync_on_conversation();