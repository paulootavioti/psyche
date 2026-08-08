CREATE OR REPLACE FUNCTION psyche_verify_document(candidate_code text)
RETURNS TABLE(number text,type text,status text,issued_at timestamptz,professional_name text,professional_registration text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path=public
SET row_security=off
AS $$
  SELECT d.number,d.type,d.status,d.issued_at,d.professional_name,d.professional_registration
  FROM psychological_documents d
  WHERE d.verification_code=upper(candidate_code)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION psyche_verify_document(text) FROM PUBLIC;
COMMENT ON FUNCTION psyche_verify_document(text) IS 'Exposes only non-clinical fields required for public document verification. Grant EXECUTE only to the API role.';
