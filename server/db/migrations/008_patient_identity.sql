CREATE OR REPLACE FUNCTION psyche_patient_login_identity(login_email text)
RETURNS TABLE(patient_id text,clinic_id text,name text,email text,password_hash text)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
  SELECT p.id,p.clinic_id,p.name,pu.email,pu.password_hash
  FROM patient_users pu JOIN patients p ON p.id=pu.patient_id
  WHERE lower(pu.email)=lower(login_email) AND pu.active=true AND p.status='active'
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION psyche_patient_login_identity(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION psyche_patient_login_identity(text) TO psyche_app;
