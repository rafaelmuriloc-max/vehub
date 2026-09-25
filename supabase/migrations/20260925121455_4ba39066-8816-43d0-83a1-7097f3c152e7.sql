CREATE TABLE public.time_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  worked_seconds integer NOT NULL DEFAULT 0,
  split_mode text NOT NULL DEFAULT 'equal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_batches_status_chk CHECK (status IN ('running','paused','finished')),
  CONSTRAINT time_batches_split_chk CHECK (split_mode IN ('equal','manual')),
  CONSTRAINT time_batches_worked_chk CHECK (worked_seconds >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_batches TO authenticated;
GRANT ALL ON public.time_batches TO service_role;
ALTER TABLE public.time_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tb select" ON public.time_batches FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tb update" ON public.time_batches FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE UNIQUE INDEX time_batches_one_open ON public.time_batches(user_id) WHERE status IN ('running','paused');
CREATE TRIGGER update_time_batches_updated_at BEFORE UPDATE ON public.time_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.time_batch_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.time_batches(id) ON DELETE CASCADE,
  paused_at timestamptz NOT NULL DEFAULT now(),
  resumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tbp_batch ON public.time_batch_pauses(batch_id);
GRANT SELECT ON public.time_batch_pauses TO authenticated;
GRANT ALL ON public.time_batch_pauses TO service_role;
ALTER TABLE public.time_batch_pauses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tbp select" ON public.time_batch_pauses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.time_batches b WHERE b.id = batch_id AND (b.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.time_batch_split_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.time_batches(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  previous jsonb NOT NULL,
  new jsonb NOT NULL
);
CREATE INDEX idx_tbsh_batch ON public.time_batch_split_history(batch_id);
GRANT SELECT ON public.time_batch_split_history TO authenticated;
GRANT ALL ON public.time_batch_split_history TO service_role;
ALTER TABLE public.time_batch_split_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tbsh select" ON public.time_batch_split_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.time_batches b WHERE b.id = batch_id AND (b.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.time_batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_batch ON public.time_entries(batch_id);

-- worked seconds up to now (excluding pauses)
CREATE OR REPLACE FUNCTION public._time_batch_worked(_id uuid, _until timestamptz)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(0, floor(extract(epoch FROM (_until - b.started_at)) - COALESCE((
    SELECT sum(extract(epoch FROM (COALESCE(p.resumed_at, _until) - p.paused_at))) FROM public.time_batch_pauses p WHERE p.batch_id = b.id
  ),0))::int)
  FROM public.time_batches b WHERE b.id = _id;
$$;
REVOKE ALL ON FUNCTION public._time_batch_worked(uuid, timestamptz) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_time_batch(_instance_ids uuid[], _label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _bid uuid; _now timestamptz := now(); r record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _instance_ids IS NULL OR array_length(_instance_ids,1) IS NULL THEN RAISE EXCEPTION 'Nenhuma obrigação selecionada'; END IF;
  IF EXISTS (SELECT 1 FROM time_batches WHERE user_id = _uid AND status IN ('running','paused')) THEN
    RAISE EXCEPTION 'Você já possui um cronômetro em lote aberto';
  END IF;
  -- encerra cronômetro individual aberto
  FOR r IN SELECT id, started_at FROM time_entries WHERE user_id = _uid AND ended_at IS NULL AND batch_id IS NULL LOOP
    UPDATE time_entries SET ended_at = _now, duration_seconds = GREATEST(1, floor(extract(epoch FROM (_now - r.started_at)))::int) WHERE id = r.id;
  END LOOP;
  INSERT INTO time_batches(user_id, label, started_at) VALUES (_uid, left(COALESCE(NULLIF(trim(_label),''),'Lote'),200), _now) RETURNING id INTO _bid;
  INSERT INTO time_entries(user_id, instance_id, started_at, batch_id, duration_seconds)
    SELECT _uid, i.id, _now, _bid, 0 FROM obligation_instances i
    WHERE i.id = ANY(_instance_ids) AND i.deleted_at IS NULL AND i.status <> 'done';
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhuma obrigação elegível'; END IF;
  RETURN _bid;
END $$;

CREATE OR REPLACE FUNCTION public._time_batch_owner_check(_id uuid, _status text[])
RETURNS public.time_batches LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b time_batches;
BEGIN
  SELECT * INTO b FROM time_batches WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  IF b.user_id <> auth.uid() AND NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NOT (b.status = ANY(_status)) THEN RAISE EXCEPTION 'Situação do lote não permite esta ação'; END IF;
  RETURN b;
END $$;
REVOKE ALL ON FUNCTION public._time_batch_owner_check(uuid, text[]) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pause_time_batch(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _time_batch_owner_check(_id, ARRAY['running']);
  INSERT INTO time_batch_pauses(batch_id) VALUES (_id);
  UPDATE time_batches SET status='paused', worked_seconds=_time_batch_worked(_id, now()) WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.resume_time_batch(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _now timestamptz := now(); r record;
BEGIN
  SELECT user_id INTO _uid FROM _time_batch_owner_check(_id, ARRAY['paused']);
  FOR r IN SELECT id, started_at FROM time_entries WHERE user_id = _uid AND ended_at IS NULL AND batch_id IS NULL LOOP
    UPDATE time_entries SET ended_at = _now, duration_seconds = GREATEST(1, floor(extract(epoch FROM (_now - r.started_at)))::int) WHERE id = r.id;
  END LOOP;
  UPDATE time_batch_pauses SET resumed_at=_now WHERE batch_id=_id AND resumed_at IS NULL;
  UPDATE time_batches SET status='running' WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.finish_time_batch(_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _now timestamptz := now(); _total int; _n int; _base int; _rest int; r record; _i int := 0;
BEGIN
  PERFORM _time_batch_owner_check(_id, ARRAY['running','paused']);
  UPDATE time_batch_pauses SET resumed_at=_now WHERE batch_id=_id AND resumed_at IS NULL;
  _total := _time_batch_worked(_id, _now);
  SELECT count(*) INTO _n FROM time_entries WHERE batch_id=_id;
  IF _n > 0 THEN
    _base := _total / _n; _rest := _total % _n;
    FOR r IN SELECT id FROM time_entries WHERE batch_id=_id ORDER BY id LOOP
      UPDATE time_entries SET ended_at=_now, duration_seconds = _base + CASE WHEN _i < _rest THEN 1 ELSE 0 END WHERE id=r.id;
      _i := _i + 1;
    END LOOP;
  END IF;
  UPDATE time_batches SET status='finished', finished_at=_now, worked_seconds=_total WHERE id=_id;
  RETURN _total;
END $$;

CREATE OR REPLACE FUNCTION public.resplit_time_batch(_id uuid, _split jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b time_batches; _prev jsonb; _sum bigint; _cnt int; _n int;
BEGIN
  b := _time_batch_owner_check(_id, ARRAY['finished']);
  SELECT jsonb_object_agg(id::text, duration_seconds), count(*) INTO _prev, _n FROM time_entries WHERE batch_id=_id;
  SELECT COALESCE(sum((value)::bigint),0), count(*) INTO _sum, _cnt FROM jsonb_each_text(_split);
  IF _cnt <> _n THEN RAISE EXCEPTION 'Informe o tempo de todas as obrigações do lote'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(_split) WHERE value::bigint < 0) THEN RAISE EXCEPTION 'Tempo negativo não é permitido'; END IF;
  IF _sum <> b.worked_seconds THEN RAISE EXCEPTION 'A soma (% s) deve ser igual ao tempo trabalhado (% s)', _sum, b.worked_seconds; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(_split) s WHERE NOT EXISTS (SELECT 1 FROM time_entries e WHERE e.batch_id=_id AND e.id::text = s.key)) THEN
    RAISE EXCEPTION 'Registro fora do lote';
  END IF;
  UPDATE time_entries e SET duration_seconds = (_split->>e.id::text)::int WHERE e.batch_id=_id;
  INSERT INTO time_batch_split_history(batch_id, changed_by, previous, new) VALUES (_id, auth.uid(), _prev, _split);
  UPDATE time_batches SET split_mode='manual' WHERE id=_id;
END $$;

REVOKE ALL ON FUNCTION public.start_time_batch(uuid[], text), public.pause_time_batch(uuid), public.resume_time_batch(uuid), public.finish_time_batch(uuid), public.resplit_time_batch(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_time_batch(uuid[], text), public.pause_time_batch(uuid), public.resume_time_batch(uuid), public.finish_time_batch(uuid), public.resplit_time_batch(uuid, jsonb) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.time_batches;