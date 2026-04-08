UPDATE public.clients SET simples_anexo = CASE main_activity
  WHEN '4211102 - Pintura para sinalização em pistas rodoviárias e aeroportos' THEN 'IV'
  WHEN '4635401 - Comércio atacadista de água mineral' THEN 'I'
END
WHERE id IN ('8e88b35f-3476-41b1-8990-dc4f12fac929', '7e192fb0-0ec3-41a4-8bb0-fe8ffff28e3d')
AND (simples_anexo IS NULL OR simples_anexo = '');