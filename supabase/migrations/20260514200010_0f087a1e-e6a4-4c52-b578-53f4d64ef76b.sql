
DO $$
DECLARE
  msg_row RECORD;
  log_row RECORD;
  body_template text;
  rendered text;
  param jsonb;
  comp jsonb;
  tpl_name text;
BEGIN
  FOR msg_row IN
    SELECT cm.id AS msg_id, cm.content, cm.created_at, cm.conversation_id
      FROM chat_messages cm
     WHERE cm.created_at >= CURRENT_DATE
       AND cm.content LIKE '[Template:%'
  LOOP
    tpl_name := substring(msg_row.content from 12 for length(msg_row.content) - 12);

    SELECT * INTO log_row
      FROM whatsapp_logs wl
     WHERE wl.template_name = tpl_name
       AND wl.sent_at BETWEEN msg_row.created_at - interval '120 seconds'
                          AND msg_row.created_at + interval '120 seconds'
     ORDER BY abs(extract(epoch from (wl.sent_at - msg_row.created_at)))
     LIMIT 1;

    IF log_row.id IS NULL THEN CONTINUE; END IF;

    SELECT oa.whatsapp_message_body INTO body_template
      FROM obligation_activities oa
     WHERE oa.whatsapp_template_name = tpl_name
       AND oa.whatsapp_message_body IS NOT NULL
     LIMIT 1;

    IF body_template IS NULL THEN CONTINUE; END IF;

    rendered := body_template;
    IF log_row.template_params IS NOT NULL THEN
      FOR comp IN SELECT * FROM jsonb_array_elements(log_row.template_params)
      LOOP
        IF comp->>'type' = 'body' THEN
          FOR param IN SELECT * FROM jsonb_array_elements(comp->'parameters')
          LOOP
            IF param ? 'parameter_name' THEN
              rendered := replace(rendered, '{{' || (param->>'parameter_name') || '}}', COALESCE(param->>'text',''));
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;

    UPDATE chat_messages SET content = rendered WHERE id = msg_row.msg_id;
  END LOOP;
END $$;
