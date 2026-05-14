
DO $$
DECLARE
  log_row RECORD;
  body_template text;
  rendered text;
  param jsonb;
  comp jsonb;
BEGIN
  FOR log_row IN
    SELECT id, client_id, template_name, sent_at, template_params
      FROM whatsapp_logs
     WHERE sent_at >= CURRENT_DATE
       AND template_name IS NOT NULL
       AND template_params IS NOT NULL
  LOOP
    SELECT oa.whatsapp_message_body INTO body_template
      FROM obligation_activities oa
     WHERE oa.whatsapp_template_name = log_row.template_name
       AND oa.whatsapp_message_body IS NOT NULL
     LIMIT 1;

    IF body_template IS NULL THEN CONTINUE; END IF;

    rendered := body_template;

    -- Iterate components looking for body params
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

    -- Update matching chat message (same client, content matches placeholder, near sent_at)
    UPDATE chat_messages cm
       SET content = rendered
      FROM chat_conversations cc
     WHERE cm.conversation_id = cc.id
       AND cc.client_id = log_row.client_id
       AND cm.content = '[Template: ' || log_row.template_name || ']'
       AND cm.created_at BETWEEN log_row.sent_at - interval '60 seconds'
                              AND log_row.sent_at + interval '60 seconds';
  END LOOP;
END $$;
