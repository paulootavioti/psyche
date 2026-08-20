CREATE TABLE legal_documents (
  key text NOT NULL,
  version text NOT NULL,
  title text NOT NULL,
  content_url text NOT NULL,
  effective_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(key,version)
);

INSERT INTO legal_documents(key,version,title,content_url,effective_at,active) VALUES
('terms_of_use','2026-08','Termos de Uso do Psyché','/termos',now(),true),
('privacy_policy','2026-08','Política de Privacidade do Psyché','/privacidade',now(),true)
ON CONFLICT DO NOTHING;

CREATE TABLE signup_requests (
  id text PRIMARY KEY,
  email text NOT NULL,
  professional_name text NOT NULL,
  clinic_name text NOT NULL,
  clinic_document text,
  phone text,
  plan_key text NOT NULL REFERENCES plans(key),
  billing_cycle text NOT NULL CHECK(billing_cycle IN ('monthly','yearly')),
  password_hash text NOT NULL,
  verification_token_hash text NOT NULL UNIQUE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  status text NOT NULL DEFAULT 'pending_email' CHECK(status IN ('pending_email','verified','expired','cancelled')),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX signup_requests_pending_email_unique
  ON signup_requests(lower(email)) WHERE status='pending_email';

CREATE TABLE legal_acceptances (
  id text PRIMARY KEY,
  clinic_id text NOT NULL REFERENCES clinics(id),
  user_id text NOT NULL REFERENCES users(id),
  document_key text NOT NULL,
  document_version text NOT NULL,
  accepted_at timestamptz NOT NULL,
  ip text,
  user_agent text,
  FOREIGN KEY(document_key,document_version) REFERENCES legal_documents(key,version)
);

ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_acceptances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_legal_acceptances ON legal_acceptances
  USING(clinic_id=current_tenant_id()) WITH CHECK(clinic_id=current_tenant_id());

GRANT SELECT ON legal_documents TO psyche_app;
GRANT SELECT,INSERT,UPDATE ON signup_requests TO psyche_app;
GRANT SELECT,INSERT ON legal_acceptances TO psyche_app;
GRANT INSERT ON clinics,clinic_subscriptions,units,users TO psyche_app;
CREATE INDEX signup_requests_expires_idx ON signup_requests(status,expires_at);
CREATE INDEX legal_acceptances_clinic_idx ON legal_acceptances(clinic_id,accepted_at DESC);
