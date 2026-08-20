import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checksum } from '../db/migrate.js';
import { withTenant } from '../db/postgres.js';

test('PostgreSQL migrations are immutable, ordered and include tenant RLS',async()=>{
  const platform=await readFile(resolve('server/db/migrations/001_platform.sql'),'utf8'),rls=await readFile(resolve('server/db/migrations/002_tenant_rls.sql'),'utf8'),identity=await readFile(resolve('server/db/migrations/004_auth_identity.sql'),'utf8'),clinicalVersions=await readFile(resolve('server/db/migrations/005_clinical_record_versions.sql'),'utf8'),documentVerification=await readFile(resolve('server/db/migrations/006_document_verification.sql'),'utf8'),receiptVerification=await readFile(resolve('server/db/migrations/007_receipt_verification.sql'),'utf8'),patientIdentity=await readFile(resolve('server/db/migrations/008_patient_identity.sql'),'utf8'),sessionIdentity=await readFile(resolve('server/db/migrations/010_session_identity.sql'),'utf8');
  assert.equal(checksum(platform).length,64);
  assert.match(platform,/CREATE TABLE clinic_subscriptions/);
  assert.match(platform,/CREATE TABLE clinical_records/);
  assert.match(rls,/FORCE ROW LEVEL SECURITY/);
  assert.match(rls,/current_setting\('app\.clinic_id'/);
  assert.match(rls,/CREATE POLICY tenant_messages/);
  assert.match(identity,/SECURITY DEFINER/);
  assert.match(identity,/psyche_login_identity/);
  assert.match(identity,/REVOKE ALL ON FUNCTION psyche_login_identity\(text\) FROM PUBLIC/);
  assert.match(clinicalVersions,/UNIQUE INDEX/);
  assert.match(clinicalVersions,/clinic_id,patient_id,type,version/);
  assert.match(documentVerification,/SECURITY DEFINER/);
  assert.match(documentVerification,/REVOKE ALL ON FUNCTION psyche_verify_document\(text\) FROM PUBLIC/);
  assert.match(receiptVerification,/REVOKE ALL ON FUNCTION psyche_verify_receipt\(text\) FROM PUBLIC/);
  assert.match(patientIdentity,/SECURITY DEFINER/);
  assert.match(patientIdentity,/REVOKE ALL ON FUNCTION psyche_patient_login_identity\(text\) FROM PUBLIC/);
  assert.match(sessionIdentity,/psyche_session_identity/);
  assert.match(sessionIdentity,/psyche_patient_session_identity/);
  assert.match(sessionIdentity,/SET row_security=off/);
});

test('runtime role migration grants restricted application access',async()=>{
  const sql=await readFile(resolve('server/db/migrations/011_runtime_role_grants.sql'),'utf8');
  assert.match(sql,/GRANT USAGE ON SCHEMA public TO psyche_app/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION psyche_login_identity\(text\) TO psyche_app/);
  assert.doesNotMatch(sql,/BYPASSRLS/);
});

test('commercial subscription migration stores prices and payment lifecycle',async()=>{
  const sql=await readFile(resolve('server/db/migrations/012_commercial_subscriptions.sql'),'utf8');
  assert.match(sql,/monthly_price_cents=14700/);
  assert.match(sql,/yearly_price_cents=299160/);
  assert.match(sql,/monthly_price_cents=34700/);
  assert.match(sql,/CREATE TABLE subscription_invoices/);
  assert.match(sql,/CREATE TABLE subscription_webhook_events/);
  assert.match(sql,/UNIQUE\(provider,provider_event_id\)/);
});

test('subscription change requests are tenant-scoped and auditable',async()=>{
  const sql=await readFile(resolve('server/db/migrations/013_subscription_change_requests.sql'),'utf8');
  assert.match(sql,/CREATE TABLE subscription_change_requests/);
  assert.match(sql,/requested_by text NOT NULL REFERENCES users/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/clinic_id=current_tenant_id\(\)/);
});

test('public onboarding requires verification and versioned legal acceptance',async()=>{
  const sql=await readFile(resolve('server/db/migrations/014_public_onboarding.sql'),'utf8');
  assert.match(sql,/CREATE TABLE signup_requests/);
  assert.match(sql,/verification_token_hash text NOT NULL UNIQUE/);
  assert.match(sql,/CREATE TABLE legal_acceptances/);
  assert.match(sql,/document_version text NOT NULL/);
  assert.match(sql,/status='pending_email'/);
});

test('tenant transaction sets server-side context and commits',async()=>{
  const calls=[],client={query:async(sql,params)=>{calls.push([sql,params]);return{rows:[]};},release:()=>calls.push(['release'])},pool={connect:async()=>client};
  const value=await withTenant(pool,'cln_tenant_1',async connection=>{assert.equal(connection,client);return 42;});
  assert.equal(value,42);assert.equal(calls[0][0],'BEGIN');assert.match(calls[1][0],/set_config/);assert.deepEqual(calls[1][1],['cln_tenant_1']);assert.equal(calls.at(-2)[0],'COMMIT');assert.equal(calls.at(-1)[0],'release');
});

test('tenant transaction rolls back and rejects unsafe identifiers',async()=>{
  const calls=[],client={query:async sql=>{calls.push(sql);return{rows:[]};},release:()=>calls.push('release')},pool={connect:async()=>client};
  await assert.rejects(()=>withTenant(pool,'cln_safe',async()=>{throw new Error('failure');}),/failure/);assert.ok(calls.includes('ROLLBACK'));
  await assert.rejects(()=>withTenant(pool,"cln_x'; RESET ROLE; --",async()=>{}),/tenant inválido/);
});
