CREATE OR REPLACE FUNCTION public.resolve_client_by_phone(_phone text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d text;
  local10 text;
  local11 text;
  v_id uuid;
  v_count int;
BEGIN
  IF _phone IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(_phone, '\D', '', 'g');
  IF length(d) < 10 THEN RETURN NULL; END IF;
  -- remove country code 55 quando presente
  IF length(d) > 11 AND left(d, 2) = '55' THEN d := substr(d, 3); END IF;
  IF length(d) = 11 THEN
    local11 := d;
    local10 := left(d, 2) || substr(d, 4);
  ELSIF length(d) = 10 THEN
    local10 := d;
    local11 := left(d, 2) || '9' || substr(d, 3);
  ELSE
    RETURN NULL;
  END IF;

  WITH matches AS (
    SELECT c.id AS client_id
      FROM public.clients c
     WHERE regexp_replace(coalesce(c.contact_phone, ''), '\D', '', 'g') <> ''
       AND (regexp_replace(c.contact_phone, '\D', '', 'g') LIKE '%' || local10
            OR regexp_replace(c.contact_phone, '\D', '', 'g') LIKE '%' || local11)
    UNION
    SELECT cdc.client_id
      FROM public.client_department_contacts cdc
     WHERE regexp_replace(coalesce(cdc.contact_phone, ''), '\D', '', 'g') <> ''
       AND (regexp_replace(cdc.contact_phone, '\D', '', 'g') LIKE '%' || local10
            OR regexp_replace(cdc.contact_phone, '\D', '', 'g') LIKE '%' || local11)
  )
  SELECT count(*), min(client_id) INTO v_count, v_id FROM (SELECT DISTINCT client_id FROM matches) m;

  IF v_count = 1 THEN RETURN v_id; END IF;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_client_by_phone(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_ticket_open_on_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'open' THEN
    INSERT INTO public.support_tickets (conversation_id, client_id, contact_name, contact_phone, department_id, assigned_to, opened_at)
    VALUES (NEW.id, COALESCE(NEW.client_id, public.resolve_client_by_phone(NEW.whatsapp_phone)), NEW.name, NEW.whatsapp_phone, NEW.triaged_department_id, NEW.assigned_to, COALESCE(NEW.created_at, now()))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_ticket_sync_on_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_count int;
  v_first timestamptz;
  v_client uuid;
  fn_url text := 'https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/ticket-summarize';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzbWdqanZhcnp6ZnNiZHB0aG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODg3MTQsImV4cCI6MjA4ODA2NDcxNH0.1GiLwH1Xc991wQ1Qg35H5_e94CXNrNFbt7Yyoj14bLo';
BEGIN
  SELECT * INTO v_ticket FROM public.support_tickets
   WHERE conversation_id = NEW.id AND status = 'open'
   ORDER BY opened_at DESC LIMIT 1;

  v_client := COALESCE(NEW.client_id, public.resolve_client_by_phone(NEW.whatsapp_phone));

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
             client_id = COALESCE(v_client, client_id),
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

  IF NEW.status = 'open' AND OLD.status IS DISTINCT FROM 'open' THEN
    IF v_ticket.id IS NULL THEN
      INSERT INTO public.support_tickets (conversation_id, client_id, contact_name, contact_phone, department_id, assigned_to, opened_at)
      VALUES (NEW.id, v_client, NEW.name, NEW.whatsapp_phone, NEW.triaged_department_id, NEW.assigned_to, now())
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  IF v_ticket.id IS NOT NULL THEN
    UPDATE public.support_tickets
       SET assigned_to = COALESCE(NEW.assigned_to, assigned_to),
           department_id = COALESCE(NEW.triaged_department_id, department_id),
           client_id = COALESCE(v_client, client_id),
           contact_name = COALESCE(NEW.name, contact_name),
           contact_phone = COALESCE(NEW.whatsapp_phone, contact_phone)
     WHERE id = v_ticket.id;
  END IF;

  RETURN NEW;
END;
$$;