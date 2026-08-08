CREATE OR REPLACE FUNCTION psyche_session_identity(candidate_token_hash text,reference_time timestamptz)
RETURNS TABLE(id text,clinic_id text,unit_id text,name text,email text,role text)
LANGUAGE sql SECURITY DEFINER SET search_path=public SET row_security=off
AS $$ SELECT u.id,u.clinic_id,u.unit_id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=candidate_token_hash AND s.expires_at>reference_time AND u.active=true LIMIT 1 $$;
REVOKE ALL ON FUNCTION psyche_session_identity(text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION psyche_session_identity(text,timestamptz) TO psyche_app;

CREATE OR REPLACE FUNCTION psyche_patient_session_identity(candidate_token_hash text,reference_time timestamptz)
RETURNS TABLE(id text,clinic_id text,name text,email text,phone text,birth_date date,professional_id text)
LANGUAGE sql SECURITY DEFINER SET search_path=public SET row_security=off
AS $$ SELECT p.id,p.clinic_id,p.name,p.email,p.phone,p.birth_date,p.professional_id FROM patient_sessions s JOIN patients p ON p.id=s.patient_id JOIN patient_users pu ON pu.patient_id=p.id WHERE s.token_hash=candidate_token_hash AND s.expires_at>reference_time AND pu.active=true AND p.status='active' LIMIT 1 $$;
REVOKE ALL ON FUNCTION psyche_patient_session_identity(text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION psyche_patient_session_identity(text,timestamptz) TO psyche_app;
