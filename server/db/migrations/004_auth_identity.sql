CREATE OR REPLACE FUNCTION psyche_login_identity(candidate_email text)
RETURNS TABLE(id text,clinic_id text,unit_id text,name text,email text,password_hash text,role text,active boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path=public
SET row_security=off
AS $$
  SELECT u.id,u.clinic_id,u.unit_id,u.name,u.email,u.password_hash,u.role,u.active
  FROM users u
  WHERE lower(u.email)=lower(candidate_email) AND u.active=true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION psyche_login_identity(text) FROM PUBLIC;
COMMENT ON FUNCTION psyche_login_identity(text) IS 'Lookup mínimo para autenticação do backend. Conceder EXECUTE somente à role da API.';
