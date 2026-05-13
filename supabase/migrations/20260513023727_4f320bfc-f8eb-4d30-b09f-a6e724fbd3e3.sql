UPDATE public.user_roles
SET role = 'employee'::app_role
WHERE user_id = '5cddbc26-627a-4aba-a3cd-e0c008494df2'
  AND role = 'admin'::app_role;