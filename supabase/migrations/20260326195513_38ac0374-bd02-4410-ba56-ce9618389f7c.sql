DELETE FROM clients
WHERE id NOT IN (
  SELECT DISTINCT ON (document) id
  FROM clients
  WHERE document IS NOT NULL
  ORDER BY document, created_at DESC
)
AND document IS NOT NULL;