CREATE OR REPLACE FUNCTION psyche_verify_receipt(candidate_code text)
RETURNS TABLE(number text,status text,amount_cents bigint,payment_date date,issued_at timestamptz,clinic_name text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public SET row_security=off
AS $$ SELECT r.number,r.status,r.amount_cents,r.payment_date,r.issued_at,c.name FROM receipts r JOIN clinics c ON c.id=r.clinic_id WHERE r.verification_code=upper(candidate_code) LIMIT 1 $$;
REVOKE ALL ON FUNCTION psyche_verify_receipt(text) FROM PUBLIC;
COMMENT ON FUNCTION psyche_verify_receipt(text) IS 'Public receipt validation without patient identity or description. Grant EXECUTE only to the API role.';
