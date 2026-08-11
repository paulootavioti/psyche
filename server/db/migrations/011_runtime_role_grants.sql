GRANT USAGE ON SCHEMA public TO psyche_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO psyche_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO psyche_app;

GRANT EXECUTE ON FUNCTION psyche_login_identity(text) TO psyche_app;
GRANT EXECUTE ON FUNCTION psyche_patient_login_identity(text) TO psyche_app;
GRANT EXECUTE ON FUNCTION psyche_session_identity(text,timestamptz) TO psyche_app;
GRANT EXECUTE ON FUNCTION psyche_patient_session_identity(text,timestamptz) TO psyche_app;
GRANT EXECUTE ON FUNCTION psyche_verify_document(text) TO psyche_app;
GRANT EXECUTE ON FUNCTION psyche_verify_receipt(text) TO psyche_app;
