CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.clinic_id', true), '') $$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'clinic_subscriptions','clinic_module_overrides','units','users','patients','patient_profiles',
    'patient_consents','patient_documents','appointments','appointment_confirmations','appointment_events',
    'unit_schedule_rules','professional_schedule_rules','professional_availability','conversations',
    'clinical_sessions','clinical_records','psychological_documents','services','clinic_settings',
    'financial_entries','suppliers','accounts_payable','receipts','fiscal_invoices','inventory_items',
    'inventory_movements','campaigns','feedback','audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (clinic_id = current_tenant_id()) WITH CHECK (clinic_id = current_tenant_id())',table_name);
  END LOOP;
END $$;

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_clinic ON clinics USING(id=current_tenant_id()) WITH CHECK(id=current_tenant_id());

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_sessions ON sessions USING(EXISTS(SELECT 1 FROM users WHERE users.id=sessions.user_id AND users.clinic_id=current_tenant_id())) WITH CHECK(EXISTS(SELECT 1 FROM users WHERE users.id=sessions.user_id AND users.clinic_id=current_tenant_id()));
ALTER TABLE patient_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_patient_users ON patient_users USING(EXISTS(SELECT 1 FROM patients WHERE patients.id=patient_users.patient_id AND patients.clinic_id=current_tenant_id())) WITH CHECK(EXISTS(SELECT 1 FROM patients WHERE patients.id=patient_users.patient_id AND patients.clinic_id=current_tenant_id()));
ALTER TABLE patient_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_patient_sessions ON patient_sessions USING(EXISTS(SELECT 1 FROM patients WHERE patients.id=patient_sessions.patient_id AND patients.clinic_id=current_tenant_id())) WITH CHECK(EXISTS(SELECT 1 FROM patients WHERE patients.id=patient_sessions.patient_id AND patients.clinic_id=current_tenant_id()));
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_messages ON messages USING(EXISTS(SELECT 1 FROM conversations WHERE conversations.id=messages.conversation_id AND conversations.clinic_id=current_tenant_id())) WITH CHECK(EXISTS(SELECT 1 FROM conversations WHERE conversations.id=messages.conversation_id AND conversations.clinic_id=current_tenant_id()));
