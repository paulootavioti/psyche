CREATE TABLE subscription_change_requests (
  id text PRIMARY KEY,
  clinic_id text NOT NULL REFERENCES clinics(id),
  requested_by text NOT NULL REFERENCES users(id),
  request_type text NOT NULL CHECK(request_type IN ('change_plan','cancel','reactivate')),
  from_plan_key text REFERENCES plans(key),
  to_plan_key text REFERENCES plans(key),
  billing_cycle text CHECK(billing_cycle IN ('monthly','yearly')),
  reason text,
  effective_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscription_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_change_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_subscription_change_requests ON subscription_change_requests
  USING(clinic_id=current_tenant_id()) WITH CHECK(clinic_id=current_tenant_id());

GRANT SELECT,INSERT,UPDATE ON subscription_change_requests TO psyche_app;
CREATE INDEX subscription_change_requests_clinic_created_idx
  ON subscription_change_requests(clinic_id,created_at DESC);
