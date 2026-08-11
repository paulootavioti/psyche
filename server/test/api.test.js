import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../database.js';
import { createApp } from '../app.js';
import { encrypt, hashToken } from '../security.js';

let app, baseUrl, token, admin;

async function request(path, { method = 'GET', body, auth = token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null, headers: response.headers };
}

before(async () => {
  app = createApp({ database: createDatabase(':memory:') });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  await new Promise(resolve => app.server.close(resolve));
  app.db.close();
});

test('health endpoint reports database and encryption state', async () => {
  const result = await request('/api/health', { auth: null });
  assert.equal(result.status, 200);
  assert.equal(result.data.database, 'sqlite');
  assert.equal(result.data.status, 'ok');
  assert.ok(result.headers.get('x-request-id'));
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(result.headers.get('cache-control'),'no-store');
  const live=await request('/api/health/live',{auth:null});
  assert.deepEqual(live.data,{status:'ok'});
  const ready=await request('/api/health/ready',{auth:null});
  assert.equal(ready.status,200);
  assert.equal(ready.data.database,'sqlite');
});

test('production refuses to start with development security defaults',()=>{
  const previous=process.env.NODE_ENV;
  process.env.NODE_ENV='production';
  try{assert.throws(()=>createApp({database:app.db}),/PSYCHE_DATA_KEY/);}
  finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});

test('authentication rejects invalid credentials and creates a valid session', async () => {
  const denied = await request('/api/auth/login', { method: 'POST', auth: null, body: { email: 'admin@psyche.local', password: 'wrong-password' } });
  assert.equal(denied.status, 401);
  const login = await request('/api/auth/login', { method: 'POST', auth: null, body: { email: 'admin@psyche.local', password: 'Psyche@2026!' } });
  assert.equal(login.status, 200);
  assert.ok(login.data.token.length > 30);
  token = login.data.token;
  admin = login.data.user;
});

test('protected endpoints require authentication', async () => {
  const result = await request('/api/patients', { auth: null });
  assert.equal(result.status, 401);
});

let patient;
test('patient creation validates, persists and returns safe fields', async () => {
  const invalid = await request('/api/patients', { method: 'POST', body: { name: 'A', email: 'invalid' } });
  assert.equal(invalid.status, 400);
  const created = await request('/api/patients', { method: 'POST', body: { name: 'Mariana Costa', email: 'mariana@example.com', phone: '11999999999', cpf: '12345678901', birth_date: '1990-05-10', professional_id: admin.id } });
  assert.equal(created.status, 201);
  assert.equal(created.data.data.name, 'Mariana Costa');
  assert.equal(created.data.data.cpf_encrypted, undefined);
  patient = created.data.data;
  const listed = await request('/api/patients?q=Mariana');
  assert.equal(listed.data.data.length, 1);
});

test('patient profile stores encrypted emergency data and exposes integrated history', async () => {
  const updated=await request(`/api/patients/${patient.id}`,{method:'PATCH',body:{phone:'11888887777',profile:{occupation:'Designer',gender:'Feminino',emergency_name:'José Costa',emergency_phone:'11977776666',address:'São Paulo'}}});
  assert.equal(updated.status,200);
  const raw=app.db.prepare('SELECT emergency_name_encrypted FROM patient_profiles WHERE patient_id=?').get(patient.id);
  assert.match(raw.emergency_name_encrypted,/^v1\./);
  assert.equal(raw.emergency_name_encrypted.includes('José'),false);
  const consent=await request(`/api/patients/${patient.id}/consents`,{method:'POST',body:{type:'Termo de atendimento',accepted:true}});
  assert.equal(consent.status,201);
  const profile=await request(`/api/patients/${patient.id}`);
  assert.equal(profile.status,200);
  assert.equal(profile.data.data.profile.emergency_name,'José Costa');
  assert.equal(profile.data.data.consents.length,1);
  assert.equal(profile.data.data.finance.paid_cents,0);
});

test('tenant scope prevents records from another clinic leaking into the session',async()=>{
  const created=new Date().toISOString();
  app.db.prepare('INSERT INTO clinics VALUES (?,?,?)').run('cln_isolated','Clínica Isolada',created);
  app.db.prepare("INSERT INTO clinic_subscriptions (clinic_id,plan_key,status,created_at,updated_at) VALUES (?,'essential','active',?,?)").run('cln_isolated',created,created);
  app.db.prepare("INSERT INTO patients (id,clinic_id,name,email,status,created_at,updated_at) VALUES (?,?,?,?, 'active',?,?)").run('pat_isolated','cln_isolated','Paciente de outro tenant','isolado@example.com',created,created);
  const listed=await request('/api/patients?q=outro');
  assert.equal(listed.status,200);
  assert.equal(listed.data.data.length,0);
});

let appointment, financialEntry;
test('appointment creation detects schedule conflicts', async () => {
  const input = { patient_id: patient.id, professional_id: admin.id, unit_id: admin.unit_id, starts_at: '2026-08-06T08:00:00.000Z', duration_minutes: 50, modality: 'online' };
  const closed=await request('/api/appointments',{method:'POST',body:input});assert.equal(closed.status,409);assert.match(closed.data.error,/Agenda fechada/);
  const unitHours=await request(`/api/schedule-rules/units/${admin.unit_id}`,{method:'PUT',body:{rules:[{weekday:4,room:'',opens_time:'00:00',closes_time:'23:59'}]}});assert.equal(unitHours.status,200);
  const professionalHours=await request(`/api/schedule-rules/professionals/${admin.id}`,{method:'PUT',body:{rules:[{weekday:4,unit_id:admin.unit_id,room:'',opens_time:'00:00',closes_time:'23:59',slot_minutes:50}]}});assert.equal(professionalHours.status,200);
  const created = await request('/api/appointments', { method: 'POST', body: input });
  assert.equal(created.status, 201);
  appointment = created.data.data;
  assert.equal(created.data.data.confirmation_status,'pending');
  assert.equal(app.db.prepare('SELECT status FROM appointment_confirmations WHERE appointment_id=?').get(appointment.id).status,'pending');
  const confirmationMessage=app.db.prepare(`SELECT m.body_encrypted FROM messages m JOIN appointment_confirmations c ON c.message_id=m.id WHERE c.appointment_id=?`).get(appointment.id);
  assert.match(confirmationMessage.body_encrypted,/^v1\./);
  const reminder=await request(`/api/appointments/${appointment.id}/confirmation`,{method:'POST'});assert.equal(reminder.status,201);
  assert.equal(app.db.prepare('SELECT reminder_count FROM appointment_confirmations WHERE appointment_id=?').get(appointment.id).reminder_count,2);
  const conflict = await request('/api/appointments', { method: 'POST', body: { ...input, starts_at: '2026-08-06T08:20:00.000Z' } });
  assert.equal(conflict.status, 409);
});

test('financial entry stores monetary values as integer cents', async () => {
  const created = await request('/api/finance', { method: 'POST', body: { patient_id: patient.id, appointment_id: appointment.id, description: 'Sessão clínica', type: 'income', amount: 280.50, due_date: '2026-08-06', status: 'paid' } });
  assert.equal(created.status, 201);
  assert.equal(created.data.data.amount_cents, 28050);
  financialEntry=created.data.data;
});

test('dashboard aggregates clinic metrics, agenda and financial series', async () => {
  const result=await request('/api/dashboard?date=2026-08-06&months=6');
  assert.equal(result.status,200);
  assert.equal(result.data.data.metrics.consultations,1);
  assert.equal(result.data.data.metrics.active_patients,1);
  assert.equal(result.data.data.agenda[0].patient_name,'Mariana Costa');
  assert.equal(result.data.data.finance.length,6);
  assert.equal(result.data.data.finance.at(-1).income,28050);
  assert.deepEqual(result.data.data.feedback.distribution,{});
});

test('management report consolidates operational and financial indicators',async()=>{
  const result=await request('/api/reports/summary?from=2026-08-01&to=2026-08-10');
  assert.equal(result.status,200);
  assert.equal(result.data.data.metrics.appointments,1);
  assert.equal(result.data.data.metrics.income_cents,28050);
  assert.equal(result.data.data.metrics.active_patients,1);
  assert.equal(result.data.data.professionals.find(x=>x.id===admin.id).appointments,1);
  assert.equal(result.data.data.daily_appointments[0].date,'2026-08-06');
  const invalid=await request('/api/reports/summary?from=2026-09-01&to=2026-08-01');
  assert.equal(invalid.status,400);
});

test('messages are encrypted and returned only through their conversation', async () => {
  const conversation = await request('/api/conversations', { method: 'POST', body: { patient_id: patient.id } });
  assert.equal(conversation.status, 201);
  const sent = await request(`/api/conversations/${conversation.data.data.id}/messages`, { method: 'POST', body: { body: 'Mensagem confidencial da clínica' } });
  assert.equal(sent.status, 201);
  const raw = app.db.prepare('SELECT body_encrypted FROM messages WHERE id=?').get(sent.data.data.id);
  assert.match(raw.body_encrypted, /^v1\./);
  assert.equal(raw.body_encrypted.includes('confidencial'), false);
  const messages = await request(`/api/conversations/${conversation.data.data.id}/messages`);
  assert.ok(messages.data.data.some(message=>message.body==='Mensagem confidencial da clínica'));
  app.db.prepare('INSERT INTO messages (id,conversation_id,sender_type,sender_id,body_encrypted,created_at) VALUES (?,?,?,?,?,?)').run('msg_patient',conversation.data.data.id,'patient',patient.id,encrypt('Preciso confirmar meu horário'),new Date().toISOString());
  const conversations=await request('/api/conversations?q=Mariana');
  assert.equal(conversations.status,200);
  assert.equal(conversations.data.data[0].last_message,'Preciso confirmar meu horário');
  assert.equal(conversations.data.data[0].unread_count,1);
  const summary=await request('/api/conversations/summary');
  assert.equal(summary.data.data.unread,1);
  const read=await request(`/api/conversations/${conversation.data.data.id}/read`,{method:'PATCH'});
  assert.equal(read.status,204);
  assert.ok(app.db.prepare('SELECT read_at FROM messages WHERE id=?').get('msg_patient').read_at);
});

let campaign;
test('campaigns and units use clinic-scoped APIs', async () => {
  const createdCampaign = await request('/api/campaigns', { method: 'POST', body: { name: 'Pesquisa pós-sessão', channel: 'email', audience: 'Pacientes atendidos' } });
  assert.equal(createdCampaign.status, 201);
  campaign=createdCampaign.data.data;
  const unit = await request('/api/units', { method: 'POST', body: { name: 'Vila Mariana', address: 'Rua Vergueiro, 2180', rooms: 2 } });
  assert.equal(unit.status, 201);
  const units = await request('/api/units');
  assert.equal(units.data.data.length, 2);
});

test('settings persist units, services, integrations and security policies',async()=>{
  const units=await request('/api/units');
  const vila=units.data.data.find(x=>x.name==='Vila Mariana');
  const updatedUnit=await request(`/api/units/${vila.id}`,{method:'PATCH',body:{rooms:4,active:true}});
  assert.equal(updatedUnit.status,200);
  assert.equal(updatedUnit.data.data.rooms,4);
  const service=await request('/api/services',{method:'POST',body:{name:'Psicoterapia individual',duration_minutes:50,price:280.50}});
  assert.equal(service.status,201);
  assert.equal(service.data.data.price_cents,28050);
  const updatedService=await request(`/api/services/${service.data.data.id}`,{method:'PATCH',body:{price:300,active:false}});
  assert.equal(updatedService.data.data.price_cents,30000);
  assert.equal(updatedService.data.data.active,0);
  const saved=await request('/api/settings',{method:'PATCH',body:{integrations:{patient_portal:true,automatic_confirmation:true},security:{session_timeout_minutes:240,two_factor_required:true},billing:{timing:'before_session',grace_days:5,overdue_action:'review',allow_clinical_override:true,cancellation_hours:24,no_show_charge_percent:50,emergency_never_block:true}}});
  assert.equal(saved.status,200);
  const settings=await request('/api/settings');
  assert.equal(settings.data.data.integrations.automatic_confirmation,true);
  assert.equal(settings.data.data.security.session_timeout_minutes,240);
  assert.equal(settings.data.data.security.two_factor_required,true);
  assert.equal(settings.data.data.billing.timing,'before_session');
  const billing=await request('/api/billing/policy');assert.equal(billing.status,200);assert.equal(billing.data.data.no_show_charge_percent,50);
  const relogin=await request('/api/auth/login',{method:'POST',auth:null,body:{email:'admin@psyche.local',password:'Psyche@2026!'}});
  const persistedSession=app.db.prepare('SELECT expires_at,created_at FROM sessions WHERE token_hash=?').get(hashToken(relogin.data.token));
  const validityMinutes=(new Date(persistedSession.expires_at)-new Date(persistedSession.created_at))/60000;
  assert.ok(validityMinutes>239&&validityMinutes<=240);
});

test('subscription context enforces modules and plan limits in the API',async()=>{
  const context=await request('/api/platform/context');assert.equal(context.status,200);assert.equal(context.data.data.tenant.id,admin.clinic_id);assert.equal(context.data.data.subscription.plan_key,'clinic');assert.equal(context.data.data.modules.analytics.enabled,true);
  const disabled=await request('/api/platform/modules',{method:'PATCH',body:{module_key:'analytics',enabled:false,reason:'Teste de configuração'}});assert.equal(disabled.status,200);assert.equal(disabled.data.data.modules.analytics.enabled,false);
  const deniedDashboard=await request('/api/dashboard');assert.equal(deniedDashboard.status,403);assert.equal(deniedDashboard.data.code,'MODULE_DISABLED');
  const enabled=await request('/api/platform/modules',{method:'PATCH',body:{module_key:'analytics',enabled:true}});assert.equal(enabled.status,200);
  app.db.prepare("UPDATE clinic_subscriptions SET plan_key='essential',updated_at=? WHERE clinic_id=?").run(new Date().toISOString(),admin.clinic_id);
  const upgradeRequired=await request('/api/platform/modules',{method:'PATCH',body:{module_key:'marketing',enabled:true}});assert.equal(upgradeRequired.status,403);assert.equal(upgradeRequired.data.code,'PLAN_UPGRADE_REQUIRED');
  const userLimit=await request('/api/team',{method:'POST',body:{name:'Usuário excedente',email:'excedente@psyche.local',password:'123456',role:'reception'}});assert.equal(userLimit.status,409);assert.equal(userLimit.data.code,'PLAN_LIMIT_REACHED');
  app.db.prepare("UPDATE clinic_subscriptions SET plan_key='clinic',updated_at=? WHERE clinic_id=?").run(new Date().toISOString(),admin.clinic_id);
  const audit=app.db.prepare("SELECT metadata FROM audit_log WHERE entity='clinic_module' AND entity_id='analytics' ORDER BY created_at DESC LIMIT 1").get();assert.ok(audit);
});

test('inventory preserves balances, costs and audited movements',async()=>{
  const created=await request('/api/inventory',{method:'POST',body:{unit_id:admin.unit_id,name:'Papel A4',sku:'PAP-A4',category:'Material de escritório',unit_measure:'pct',quantity:10,minimum_quantity:3,unit_cost:32.50}});
  assert.equal(created.status,201);
  assert.equal(created.data.data.unit_cost_cents,3250);
  const item=created.data.data;
  const output=await request(`/api/inventory/${item.id}/movements`,{method:'POST',body:{type:'out',quantity:4,reason:'Consumo da recepção'}});
  assert.equal(output.status,201);
  assert.equal(output.data.data.balance_after,6);
  const denied=await request(`/api/inventory/${item.id}/movements`,{method:'POST',body:{type:'out',quantity:7,reason:'Saída acima do saldo'}});
  assert.equal(denied.status,409);
  const adjustment=await request(`/api/inventory/${item.id}/movements`,{method:'POST',body:{type:'adjustment',quantity:2,reason:'Contagem física'}});
  assert.equal(adjustment.status,201);
  assert.equal(adjustment.data.data.quantity,-4);
  const summary=await request('/api/inventory/summary');
  assert.equal(summary.data.data.items,1);
  assert.equal(summary.data.data.low_stock,1);
  assert.equal(summary.data.data.value_cents,6500);
  const history=await request(`/api/inventory/${item.id}/movements`);
  assert.equal(history.data.data.length,3);
});

test('accounts payable handles suppliers, installments and financial posting',async()=>{
  const supplier=await request('/api/suppliers',{method:'POST',body:{name:'Imobiliária Jardins',document:'12345678000100',email:'financeiro@imobiliaria.com'}});
  assert.equal(supplier.status,201);
  const created=await request('/api/payables',{method:'POST',body:{supplier_id:supplier.data.data.id,unit_id:admin.unit_id,description:'Aluguel da unidade',category:'Aluguel e condomínio',amount:4200,due_date:'2026-08-10',installments:2,recurrence:null}});
  assert.equal(created.status,201);
  assert.equal(created.data.data.length,2);
  assert.equal(created.data.data[1].due_date,'2026-09-10');
  const first=created.data.data[0],second=created.data.data[1];
  const paid=await request(`/api/payables/${first.id}`,{method:'PATCH',body:{action:'pay',paid_at:'2026-08-08T12:00:00Z'}});
  assert.equal(paid.status,200);
  assert.equal(paid.data.data.status,'paid');
  const expense=app.db.prepare('SELECT * FROM financial_entries WHERE id=?').get(paid.data.data.financial_entry_id);
  assert.equal(expense.type,'expense');
  assert.equal(expense.amount_cents,420000);
  const duplicate=await request(`/api/payables/${first.id}`,{method:'PATCH',body:{action:'pay'}});
  assert.equal(duplicate.status,409);
  const cancelled=await request(`/api/payables/${second.id}`,{method:'PATCH',body:{action:'cancel'}});
  assert.equal(cancelled.data.data.status,'cancelled');
  const summary=await request('/api/payables/summary?month=2026-08');
  assert.equal(summary.data.data.paid_cents,420000);
  assert.equal(summary.data.data.total,1);
});

test('receipts are sequential, verifiable, immutable and cancellable',async()=>{
  const created=await request('/api/receipts',{method:'POST',body:{patient_id:patient.id,financial_entry_id:financialEntry.id,patient_document:'12345678901'}});
  assert.equal(created.status,201);
  assert.match(created.data.data.number,/^REC-\d{4}-000001$/);
  assert.equal(created.data.data.amount_cents,28050);
  assert.ok(created.data.data.verification_code.length>=10);
  const duplicate=await request('/api/receipts',{method:'POST',body:{patient_id:patient.id,financial_entry_id:financialEntry.id}});
  assert.equal(duplicate.status,409);
  const detail=await request(`/api/receipts/${created.data.data.id}`);
  assert.equal(detail.data.data.patient_name,'Mariana Costa');
  assert.equal(detail.data.data.clinic_name,'Psyché Saúde');
  const cancelled=await request(`/api/receipts/${created.data.data.id}`,{method:'PATCH',body:{cancellation_reason:'Correção de dados cadastrais'}});
  assert.equal(cancelled.status,200);
  assert.equal(cancelled.data.data.status,'cancelled');
  const repeatedCancel=await request(`/api/receipts/${created.data.data.id}`,{method:'PATCH',body:{cancellation_reason:'Novo motivo'}});
  assert.equal(repeatedCancel.status,409);
  const summary=await request(`/api/receipts/summary?year=${created.data.data.issued_at.slice(0,4)}`);
  assert.equal(summary.data.data.cancelled,1);
});

test('fiscal invoice control keeps internal and municipal states distinct',async()=>{
  const created=await request('/api/invoices',{method:'POST',body:{patient_id:patient.id,service_code:'06.01',description:'Serviços de psicologia',amount:280.50,patient_document:'12345678901'}});
  assert.equal(created.status,201);assert.match(created.data.data.internal_number,/^NFS-\d{4}-000001$/);assert.equal(created.data.data.status,'draft');
  const authorized=await request(`/api/invoices/${created.data.data.id}`,{method:'PATCH',body:{action:'authorize',external_number:'202600001',provider:'Prefeitura de Teste',external_id:'EXT-1',verification_url:'https://example.test/nfse/1'}});
  assert.equal(authorized.status,200);assert.equal(authorized.data.data.status,'authorized');assert.equal(authorized.data.data.external_number,'202600001');
  const cancelled=await request(`/api/invoices/${created.data.data.id}`,{method:'PATCH',body:{action:'cancel',reason:'Cancelamento autorizado pelo município'}});
  assert.equal(cancelled.status,200);assert.equal(cancelled.data.data.status,'cancelled');
  const summary=await request(`/api/invoices/summary?year=${created.data.data.created_at.slice(0,4)}`);assert.equal(summary.data.data.cancelled,1);
});

test('marketing manages campaign lifecycle and encrypted patient feedback',async()=>{
  const activated=await request(`/api/campaigns/${campaign.id}`,{method:'PATCH',body:{status:'active'}});
  assert.equal(activated.status,200);
  assert.equal(activated.data.data.status,'active');
  const created=await request('/api/feedback',{method:'POST',body:{patient_id:patient.id,appointment_id:appointment.id,score:5,comment:'Atendimento muito acolhedor'}});
  assert.equal(created.status,201);
  const raw=app.db.prepare('SELECT comment_encrypted FROM feedback WHERE id=?').get(created.data.data.id);
  assert.match(raw.comment_encrypted,/^v1\./);
  assert.equal(raw.comment_encrypted.includes('acolhedor'),false);
  const summary=await request('/api/feedback/summary?days=30');
  assert.equal(summary.data.data.average,5);
  assert.equal(summary.data.data.positive_rate,100);
  assert.equal(summary.data.data.active_campaigns,1);
  const listed=await request('/api/feedback');
  assert.equal(listed.data.data[0].comment,'Atendimento muito acolhedor');
  const archived=await request(`/api/campaigns/${campaign.id}`,{method:'DELETE'});
  assert.equal(archived.status,204);
});

test('team management applies roles, protects administrators and resets passwords', async () => {
  const roles=await request('/api/roles');assert.equal(roles.status,200);assert.ok(roles.data.data.find(x=>x.key==='professional').permissions.includes('sessions:read'));
  const created=await request('/api/team',{method:'POST',body:{name:'Beatriz Rocha',email:'beatriz@psyche.local',password:'Temporaria@2026',role:'reception',unit_id:admin.unit_id}});assert.equal(created.status,201);
  const detail=await request(`/api/team/${created.data.data.id}`);assert.equal(detail.data.data.role,'reception');
  const suspended=await request(`/api/team/${created.data.data.id}`,{method:'PATCH',body:{active:false}});assert.equal(suspended.status,200);assert.equal(suspended.data.data.active,0);
  const protectedSelf=await request(`/api/team/${admin.id}`,{method:'PATCH',body:{active:false}});assert.equal(protectedSelf.status,400);
  const reset=await request(`/api/team/${created.data.data.id}/reset-password`,{method:'POST',body:{temporary_password:'NovaSenha@2026'}});assert.equal(reset.status,204);
});

test('clinical notes are encrypted at rest and decrypted only through an authorized endpoint', async () => {
  const created = await request('/api/clinical-sessions', { method: 'POST', body: { appointment_id: appointment.id, patient_id: patient.id, duration_seconds: 1200, notes: 'Rascunho clínico', sud_history: [{ value: 7, at: '08:10' }] } });
  assert.equal(created.status, 201);
  const saved = await request(`/api/clinical-sessions/${created.data.data.id}`, { method:'PATCH', body:{ duration_seconds:3120, notes:'Conteúdo clínico confidencial', sud_history:[{value:7,at:'08:10'}] } });
  assert.equal(saved.status,200);
  const raw = app.db.prepare('SELECT notes_encrypted FROM clinical_sessions WHERE id=?').get(created.data.data.id);
  assert.match(raw.notes_encrypted, /^v1\./);
  assert.equal(raw.notes_encrypted.includes('confidencial'), false);
  const read = await request(`/api/clinical-sessions/${created.data.data.id}`);
  assert.equal(read.status, 200);
  assert.equal(read.data.data.notes, 'Conteúdo clínico confidencial');
  assert.equal(read.data.data.sud_history[0].value, 7);
  const finished=await request(`/api/clinical-sessions/${created.data.data.id}`,{method:'PATCH',body:{duration_seconds:3200,notes:'Conteúdo clínico confidencial',sud_history:[{value:7,at:'08:10'}],finished_at:'2026-08-05T12:00:00.000Z'}});
  assert.equal(finished.status,200);
  assert.equal(app.db.prepare('SELECT status FROM appointments WHERE id=?').get(appointment.id).status,'completed');
  const locked=await request(`/api/clinical-sessions/${created.data.data.id}`,{method:'PATCH',body:{notes:'Alteração indevida'}});
  assert.equal(locked.status,409);
});

test('longitudinal clinical records support encrypted anamnesis and case planning versions',async()=>{
  const anamnesis=await request(`/api/patients/${patient.id}/clinical-records`,{method:'POST',body:{type:'anamnesis',title:'Anamnese inicial',content:{demand:'Ansiedade e impacto no sono',support_network:'Família e amigos'},visibility:'record',status:'active'}});
  assert.equal(anamnesis.status,201);assert.equal(anamnesis.data.data.version,1);
  const plan=await request(`/api/patients/${patient.id}/clinical-records`,{method:'POST',body:{type:'case_plan',title:'Plano inicial',content:{formulation:'Hipótese compreensiva em construção',objectives:'Ampliar regulação emocional'},visibility:'restricted',status:'draft'}});
  assert.equal(plan.status,201);
  const raw=app.db.prepare('SELECT content_encrypted FROM clinical_records WHERE id=?').get(plan.data.data.id);assert.match(raw.content_encrypted,/^v1\./);assert.equal(raw.content_encrypted.includes('regulação'),false);
  const records=await request(`/api/patients/${patient.id}/clinical-records`);assert.equal(records.status,200);assert.equal(records.data.data.length,2);assert.equal(records.data.data.find(x=>x.type==='anamnesis').content.demand,'Ansiedade e impacto no sono');
  const second=await request(`/api/patients/${patient.id}/clinical-records`,{method:'POST',body:{type:'case_plan',title:'Revisão do plano',content:{objectives:'Reavaliar objetivos'},visibility:'record',status:'active'}});assert.equal(second.data.data.version,2);
});

test('psychological certificates and non-medication guidance are encrypted and auditable',async()=>{
  const certificate=await request(`/api/patients/${patient.id}/psychological-documents`,{method:'POST',body:{type:'certificate',title:'Atestado psicológico',recipient:'Empresa',purpose:'Justificar impedimento temporário',professional_name:'Carolina Martins',professional_registration:'CRP 00/000001',issue:true,content:{requested_by:'Mariana Costa',request_date:'2026-08-05',basis:'Avaliação psicológica registrada',conclusion:'Necessidade de afastamento temporário',leave_start:'2026-08-05',leave_end:'2026-08-07'}}});
  assert.equal(certificate.status,201,JSON.stringify(certificate.data));assert.equal(certificate.data.data.status,'issued');assert.match(certificate.data.data.number,/^ATE-2026-/);
  const raw=app.db.prepare('SELECT content_encrypted FROM psychological_documents WHERE id=?').get(certificate.data.data.id);assert.match(raw.content_encrypted,/^v1\./);assert.equal(raw.content_encrypted.includes('afastamento'),false);
  const verified=await request(`/api/psychological-documents/verify/${certificate.data.data.verification_code}`,{auth:null});assert.equal(verified.status,200);assert.equal(verified.data.data.number,certificate.data.data.number);assert.equal(verified.data.data.patient_id,undefined);
  const guidance=await request(`/api/patients/${patient.id}/psychological-documents`,{method:'POST',body:{type:'guidance',title:'Orientações psicológicas',purpose:'Continuidade do cuidado',professional_name:'Carolina Martins',professional_registration:'CRP 00/000001',content:{recommendations:'Manter rotina de acompanhamento e estratégias acordadas'},issue:false}});assert.equal(guidance.status,201);assert.equal(guidance.data.data.status,'draft');
  const issued=await request(`/api/psychological-documents/${guidance.data.data.id}`,{method:'PATCH',body:{action:'issue'}});assert.equal(issued.data.data.status,'issued');
  const listed=await request(`/api/patients/${patient.id}/psychological-documents`);assert.equal(listed.data.data.length,2);assert.equal(listed.data.data[0].content.recommendations,'Manter rotina de acompanhamento e estratégias acordadas');
});

test('appointment can be rescheduled, completed and softly cancelled', async () => {
  const rescheduled=await request(`/api/appointments/${appointment.id}`,{method:'PATCH',body:{starts_at:'2026-08-06T14:00:00.000Z',duration_minutes:60,status:'completed'}});
  assert.equal(rescheduled.status,200);
  assert.equal(rescheduled.data.data.duration_minutes,60);
  assert.equal(rescheduled.data.data.status,'completed');
  const cancelled=await request(`/api/appointments/${appointment.id}`,{method:'DELETE'});
  assert.equal(cancelled.status,204);
  const stored=app.db.prepare('SELECT status FROM appointments WHERE id=?').get(appointment.id);
  assert.equal(stored.status,'cancelled');
});

test('audit trail records sensitive operations', async () => {
  const result = await request('/api/audit');
  assert.equal(result.status, 200);
  assert.ok(result.data.data.some(entry => entry.entity === 'clinical_session'));
  assert.ok(result.data.data.some(entry => entry.entity === 'patient'));
});

test('finance summary, filters, editing and soft void work together', async()=>{
  const summary=await request('/api/finance/summary?month=2026-08');
  assert.equal(summary.status,200);
  assert.equal(summary.data.data.received_cents,28050);
  const filtered=await request('/api/finance?type=income&status=paid&from=2026-08-01&to=2026-08-31&q=clínica');
  assert.equal(filtered.data.data.length,1);
  assert.equal(filtered.data.data[0].patient_name,'Mariana Costa');
  const edited=await request(`/api/finance/${financialEntry.id}`,{method:'PATCH',body:{description:'Sessão clínica atualizada',amount:300,status:'pending'}});
  assert.equal(edited.status,200);
  assert.equal(edited.data.data.amount_cents,30000);
  assert.equal(edited.data.data.status,'pending');
  const removed=await request(`/api/finance/${financialEntry.id}`,{method:'DELETE'});
  assert.equal(removed.status,204);
  assert.equal(app.db.prepare('SELECT status FROM financial_entries WHERE id=?').get(financialEntry.id).status,'void');
});

test('patient portal has independent credentials and exposes only patient-safe routes',async()=>{
  const tooShort=await request(`/api/patients/${patient.id}/portal-access`,{method:'POST',body:{email:'mariana@example.com',password:'12345'}});assert.equal(tooShort.status,400);
  const configured=await request(`/api/patients/${patient.id}/portal-access`,{method:'POST',body:{email:'mariana@example.com',password:'123456'}});assert.equal(configured.status,200);
  const denied=await request('/api/portal/auth/login',{method:'POST',auth:null,body:{email:'mariana@example.com',password:'senha-incorreta'}});assert.equal(denied.status,401);
  const login=await request('/api/portal/auth/login',{method:'POST',auth:null,body:{email:'mariana@example.com',password:'123456'}});assert.equal(login.status,200);const patientToken=login.data.token;
  const portal=await request('/api/portal/me',{auth:patientToken});assert.equal(portal.status,200);assert.equal(portal.data.data.patient.id,patient.id);assert.equal(portal.data.data.patient.cpf_encrypted,undefined);assert.equal(portal.data.data.clinical_records,undefined);assert.ok(Array.isArray(portal.data.data.appointments));
  const sent=await request('/api/portal/messages',{method:'POST',auth:patientToken,body:{body:'Mensagem enviada pelo portal'}});assert.equal(sent.status,201);assert.equal(sent.data.data.sender_type,'patient');
  const messages=await request('/api/portal/messages',{auth:patientToken});assert.equal(messages.status,200);assert.ok(messages.data.data.some(item=>item.body==='Mensagem enviada pelo portal'));
  const staffRoute=await request('/api/patients',{auth:patientToken});assert.equal(staffRoute.status,401);
});

test('logout invalidates the current token', async () => {
  const logout = await request('/api/auth/logout', { method: 'POST' });
  assert.equal(logout.status, 204);
  const denied = await request('/api/patients');
  assert.equal(denied.status, 401);
});

test('login rate limiter blocks repeated invalid attempts', async () => {
  for(let attempt=1;attempt<=5;attempt++){
    const result=await request('/api/auth/login',{method:'POST',auth:null,body:{email:'blocked@psyche.local',password:'invalid-password'}});
    assert.equal(result.status,401);
  }
  const blocked=await request('/api/auth/login',{method:'POST',auth:null,body:{email:'blocked@psyche.local',password:'invalid-password'}});
  assert.equal(blocked.status,429);
  assert.ok(Number(blocked.headers.get('retry-after'))>0);
});
