ALTER TABLE plans ADD COLUMN monthly_price_cents bigint;
ALTER TABLE plans ADD COLUMN yearly_price_cents bigint;
ALTER TABLE plans ADD COLUMN currency text NOT NULL DEFAULT 'BRL';
ALTER TABLE plans ADD COLUMN description text;

UPDATE plans SET
  monthly_price_cents=14700,
  yearly_price_cents=158760,
  description='Para psicóloga ou psicólogo autônomo',
  limits_json='{"users":1,"units":1,"patients":300,"storage_mb":1024}'::jsonb
WHERE key='essential';

UPDATE plans SET
  monthly_price_cents=27700,
  yearly_price_cents=299160,
  description='Para estruturas a partir de 2 consultórios',
  limits_json='{"users":5,"units":2,"patients":1500,"storage_mb":5120}'::jsonb
WHERE key='professional';

UPDATE plans SET active=false WHERE key='clinic';

UPDATE plans SET
  name='Enterprise',
  monthly_price_cents=34700,
  yearly_price_cents=374760,
  description='Para clínicas com gestão e integração de NFS-e',
  limits_json='{"users":50,"units":10,"patients":15000,"storage_mb":51200}'::jsonb
WHERE key='enterprise';

ALTER TABLE clinic_subscriptions ADD COLUMN billing_cycle text CHECK(billing_cycle IN ('monthly','yearly'));
ALTER TABLE clinic_subscriptions ADD COLUMN provider text;
ALTER TABLE clinic_subscriptions ADD COLUMN provider_customer_id text;
ALTER TABLE clinic_subscriptions ADD COLUMN provider_subscription_id text;
ALTER TABLE clinic_subscriptions ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false;
ALTER TABLE clinic_subscriptions ADD COLUMN cancelled_at timestamptz;

CREATE UNIQUE INDEX clinic_subscriptions_provider_subscription_unique
  ON clinic_subscriptions(provider,provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE TABLE subscription_provider_plans (
  plan_key text NOT NULL REFERENCES plans(key),
  billing_cycle text NOT NULL CHECK(billing_cycle IN ('monthly','yearly')),
  provider text NOT NULL,
  provider_plan_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(plan_key,billing_cycle,provider),
  UNIQUE(provider,provider_plan_id)
);

CREATE TABLE subscription_invoices (
  id text PRIMARY KEY,
  clinic_id text NOT NULL REFERENCES clinics(id),
  provider text NOT NULL,
  provider_invoice_id text NOT NULL,
  provider_payment_id text,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL CHECK(status IN ('pending','paid','failed','refunded','cancelled')),
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_invoice_id)
);

CREATE TABLE subscription_webhook_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  resource_id text,
  payload_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','processed','ignored','failed')),
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(provider,provider_event_id)
);

ALTER TABLE subscription_provider_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_provider_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_subscription_invoices ON subscription_invoices
  USING(clinic_id=current_tenant_id()) WITH CHECK(clinic_id=current_tenant_id());

GRANT SELECT ON plans,subscription_provider_plans TO psyche_app;
GRANT SELECT,INSERT,UPDATE ON subscription_invoices TO psyche_app;
GRANT SELECT,INSERT,UPDATE ON subscription_webhook_events TO psyche_app;

CREATE INDEX subscription_invoices_clinic_created_idx ON subscription_invoices(clinic_id,created_at DESC);
CREATE INDEX subscription_webhook_events_status_idx ON subscription_webhook_events(status,received_at);
