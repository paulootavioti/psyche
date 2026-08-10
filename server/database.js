import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { decrypt, encrypt, hashPassword } from './security.js';

const now = () => new Date().toISOString();
const id = prefix => `${prefix}_${crypto.randomUUID()}`;

export function createDatabase(filename = process.env.PSYCHE_DB_PATH || resolve('data/psyche.sqlite')) {
  const { DatabaseSync } = createRequire(resolve('server/database.js'))('node:sqlite');
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS clinics (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS plans (key TEXT PRIMARY KEY, name TEXT NOT NULL, modules_json TEXT NOT NULL, limits_json TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS clinic_subscriptions (clinic_id TEXT PRIMARY KEY REFERENCES clinics(id), plan_key TEXT NOT NULL REFERENCES plans(key), status TEXT NOT NULL CHECK(status IN ('trialing','active','past_due','suspended','cancelled')), trial_ends_at TEXT, current_period_ends_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS clinic_module_overrides (clinic_id TEXT NOT NULL REFERENCES clinics(id), module_key TEXT NOT NULL, enabled INTEGER NOT NULL, reason TEXT, updated_by TEXT REFERENCES users(id), updated_at TEXT NOT NULL, PRIMARY KEY(clinic_id,module_key));
    CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), name TEXT NOT NULL, address TEXT, rooms INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), unit_id TEXT REFERENCES units(id), name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','professional','reception','finance')), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS patient_users (patient_id TEXT PRIMARY KEY REFERENCES patients(id), email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, last_login TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS patient_sessions (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id), token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), professional_id TEXT REFERENCES users(id), name TEXT NOT NULL, email TEXT, phone TEXT, cpf_encrypted TEXT, birth_date TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS patient_profiles (patient_id TEXT PRIMARY KEY REFERENCES patients(id), clinic_id TEXT NOT NULL REFERENCES clinics(id), gender TEXT, occupation TEXT, emergency_name_encrypted TEXT, emergency_phone_encrypted TEXT, address_encrypted TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS patient_consents (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT NOT NULL REFERENCES patients(id), type TEXT NOT NULL, accepted INTEGER NOT NULL DEFAULT 0, accepted_at TEXT, expires_at TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS patient_documents (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT NOT NULL REFERENCES patients(id), name TEXT NOT NULL, mime_type TEXT NOT NULL, storage_key TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), unit_id TEXT REFERENCES units(id), patient_id TEXT NOT NULL REFERENCES patients(id), professional_id TEXT NOT NULL REFERENCES users(id), starts_at TEXT NOT NULL, duration_minutes INTEGER NOT NULL DEFAULT 50, modality TEXT NOT NULL, room TEXT, status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS appointment_confirmations (appointment_id TEXT PRIMARY KEY REFERENCES appointments(id), clinic_id TEXT NOT NULL REFERENCES clinics(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','reschedule_requested','declined')), requested_at TEXT NOT NULL, responded_at TEXT, response_note TEXT, message_id TEXT REFERENCES messages(id), reminder_count INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS appointment_events (id TEXT PRIMARY KEY, appointment_id TEXT NOT NULL REFERENCES appointments(id), clinic_id TEXT NOT NULL REFERENCES clinics(id), actor_type TEXT NOT NULL CHECK(actor_type IN ('staff','patient','system')), actor_id TEXT, type TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS professional_availability (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), professional_id TEXT NOT NULL REFERENCES users(id), unit_id TEXT REFERENCES units(id), opens_at TEXT NOT NULL, closes_at TEXT NOT NULL, slot_minutes INTEGER NOT NULL DEFAULT 50, active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS unit_schedule_rules (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), unit_id TEXT NOT NULL REFERENCES units(id), room TEXT NOT NULL DEFAULT '', weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6), opens_time TEXT NOT NULL, closes_time TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, UNIQUE(unit_id,room,weekday,opens_time,closes_time));
    CREATE TABLE IF NOT EXISTS professional_schedule_rules (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), professional_id TEXT NOT NULL REFERENCES users(id), unit_id TEXT NOT NULL REFERENCES units(id), room TEXT NOT NULL DEFAULT '', weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6), opens_time TEXT NOT NULL, closes_time TEXT NOT NULL, slot_minutes INTEGER NOT NULL DEFAULT 50, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, UNIQUE(professional_id,unit_id,room,weekday,opens_time,closes_time));
    CREATE TABLE IF NOT EXISTS financial_entries (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT REFERENCES patients(id), appointment_id TEXT REFERENCES appointments(id), description TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense')), amount_cents INTEGER NOT NULL, due_date TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT NOT NULL REFERENCES patients(id), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), sender_type TEXT NOT NULL, sender_id TEXT NOT NULL, body_encrypted TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT);
    CREATE TABLE IF NOT EXISTS clinical_sessions (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), appointment_id TEXT REFERENCES appointments(id), patient_id TEXT NOT NULL REFERENCES patients(id), professional_id TEXT NOT NULL REFERENCES users(id), started_at TEXT NOT NULL, finished_at TEXT, duration_seconds INTEGER NOT NULL DEFAULT 0, notes_encrypted TEXT, sud_history_encrypted TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS clinical_records (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT NOT NULL REFERENCES patients(id), professional_id TEXT NOT NULL REFERENCES users(id), session_id TEXT REFERENCES clinical_sessions(id), type TEXT NOT NULL CHECK(type IN ('anamnesis','case_plan','evolution','referral','closure')), title TEXT NOT NULL, content_encrypted TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'record' CHECK(visibility IN ('record','restricted')), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','completed','archived')), version INTEGER NOT NULL DEFAULT 1, occurred_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS psychological_documents (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT NOT NULL REFERENCES patients(id), professional_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL CHECK(type IN ('certificate','guidance')), number TEXT NOT NULL, verification_code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, recipient TEXT, purpose TEXT NOT NULL, content_encrypted TEXT NOT NULL, professional_name TEXT NOT NULL, professional_registration TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','cancelled')), issued_at TEXT, cancelled_at TEXT, cancellation_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), name TEXT NOT NULL, channel TEXT NOT NULL, audience TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), name TEXT NOT NULL, duration_minutes INTEGER NOT NULL, price_cents INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS clinic_settings (clinic_id TEXT NOT NULL REFERENCES clinics(id), key TEXT NOT NULL, value_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (clinic_id,key));
    CREATE TABLE IF NOT EXISTS inventory_items (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), unit_id TEXT REFERENCES units(id), name TEXT NOT NULL, sku TEXT, category TEXT NOT NULL, unit_measure TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 0, minimum_quantity REAL NOT NULL DEFAULT 0, unit_cost_cents INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS inventory_movements (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), item_id TEXT NOT NULL REFERENCES inventory_items(id), user_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL CHECK(type IN ('in','out','adjustment')), quantity REAL NOT NULL, balance_after REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), name TEXT NOT NULL, document TEXT, email TEXT, phone TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts_payable (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), supplier_id TEXT REFERENCES suppliers(id), unit_id TEXT REFERENCES units(id), financial_entry_id TEXT REFERENCES financial_entries(id), description TEXT NOT NULL, category TEXT NOT NULL, amount_cents INTEGER NOT NULL, due_date TEXT NOT NULL, paid_at TEXT, status TEXT NOT NULL DEFAULT 'pending', installment_number INTEGER NOT NULL DEFAULT 1, installment_total INTEGER NOT NULL DEFAULT 1, recurrence TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT NOT NULL REFERENCES patients(id), financial_entry_id TEXT REFERENCES financial_entries(id), number TEXT NOT NULL, verification_code TEXT NOT NULL UNIQUE, patient_name TEXT NOT NULL, patient_document TEXT, description TEXT NOT NULL, amount_cents INTEGER NOT NULL, payment_date TEXT NOT NULL, issued_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'issued', cancelled_at TEXT, cancellation_reason TEXT, created_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS fiscal_invoices (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT NOT NULL REFERENCES patients(id), financial_entry_id TEXT REFERENCES financial_entries(id), receipt_id TEXT REFERENCES receipts(id), internal_number TEXT NOT NULL, external_number TEXT, provider TEXT, external_id TEXT, verification_url TEXT, patient_name TEXT NOT NULL, patient_document TEXT, service_code TEXT NOT NULL, description TEXT NOT NULL, amount_cents INTEGER NOT NULL, issued_at TEXT, status TEXT NOT NULL DEFAULT 'draft', error_message TEXT, cancelled_at TEXT, cancellation_reason TEXT, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL REFERENCES clinics(id), patient_id TEXT REFERENCES patients(id), appointment_id TEXT REFERENCES appointments(id), score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5), comment_encrypted TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, clinic_id TEXT, user_id TEXT, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT, metadata TEXT, ip TEXT, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_appointments_clinic_start ON appointments(clinic_id, starts_at);
    CREATE INDEX IF NOT EXISTS idx_appointment_events_history ON appointment_events(appointment_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_availability_professional_period ON professional_availability(professional_id, opens_at, closes_at);
    CREATE INDEX IF NOT EXISTS idx_unit_rules_schedule ON unit_schedule_rules(unit_id,weekday,active);
    CREATE INDEX IF NOT EXISTS idx_professional_rules_schedule ON professional_schedule_rules(professional_id,weekday,active);
    CREATE INDEX IF NOT EXISTS idx_patients_clinic_name ON patients(clinic_id, name);
    CREATE INDEX IF NOT EXISTS idx_patient_sessions_expiry ON patient_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_consents_patient ON patient_consents(patient_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_finance_clinic_created ON financial_entries(clinic_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_clinic_created ON audit_log(clinic_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_feedback_clinic_created ON feedback(clinic_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_clinical_records_patient ON clinical_records(patient_id, type, created_at);
    CREATE INDEX IF NOT EXISTS idx_psychological_documents_patient ON psychological_documents(patient_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_psychological_documents_number ON psychological_documents(clinic_id, number);
    CREATE INDEX IF NOT EXISTS idx_inventory_clinic_name ON inventory_items(clinic_id, name);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON inventory_movements(item_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_payables_clinic_due ON accounts_payable(clinic_id, due_date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_clinic_number ON receipts(clinic_id, number);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_clinic_internal ON fiscal_invoices(clinic_id, internal_number);
  `);

  const appointmentColumns = db.prepare('PRAGMA table_info(appointments)').all().map(column => column.name);
  if (!appointmentColumns.includes('booking_type')) db.exec("ALTER TABLE appointments ADD COLUMN booking_type TEXT NOT NULL DEFAULT 'regular'");

  const existing = db.prepare('SELECT id FROM clinics LIMIT 1').get();
  if (!existing) {
    const clinicId = id('cln'), unitId = id('unt'), userId = id('usr'), created = now();
    db.prepare('INSERT INTO clinics VALUES (?, ?, ?)').run(clinicId, 'Psyché Saúde', created);
    db.prepare('INSERT INTO units (id, clinic_id, name, address, rooms, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(unitId, clinicId, 'Jardins', 'Rua Oscar Freire, 1200', 3, created);
    db.prepare('INSERT INTO users (id, clinic_id, unit_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(userId, clinicId, unitId, 'Carolina Martins', 'admin@psyche.local', hashPassword(process.env.PSYCHE_ADMIN_PASSWORD || 'Psyche@2026!'), 'admin', created);
  }
  const plans={essential:{name:'Essencial',modules:['core','clinical','communication'],limits:{users:1,units:1,patients:300,storage_mb:1024}},professional:{name:'Profissional',modules:['core','clinical','finance','communication','analytics','telehealth'],limits:{users:5,units:2,patients:1500,storage_mb:5120}},clinic:{name:'Clínica',modules:['core','clinical','finance','inventory','communication','marketing','analytics','telehealth'],limits:{users:50,units:10,patients:15000,storage_mb:51200}},enterprise:{name:'Enterprise',modules:['core','clinical','finance','inventory','communication','marketing','analytics','telehealth'],limits:{users:null,units:null,patients:null,storage_mb:null}}};
  for(const[key,plan]of Object.entries(plans))db.prepare('INSERT OR IGNORE INTO plans VALUES (?,?,?,?,1,?)').run(key,plan.name,JSON.stringify(plan.modules),JSON.stringify(plan.limits),now());
  for(const clinic of db.prepare('SELECT id FROM clinics').all())db.prepare("INSERT OR IGNORE INTO clinic_subscriptions (clinic_id,plan_key,status,created_at,updated_at) VALUES (?,'clinic','active',?,?)").run(clinic.id,now(),now());
  return db;
}

export const helpers = {
  now, id,
  one(db, sql, ...params) { return db.prepare(sql).get(...params); },
  all(db, sql, ...params) { return db.prepare(sql).all(...params); },
  audit(db, actor, action, entity, entityId, metadata = {}, ip = '') { db.prepare('INSERT INTO audit_log VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id('aud'), actor?.clinic_id || null, actor?.id || null, action, entity, entityId || null, JSON.stringify(metadata), ip, now()); },
  decodeClinical(row) { if (!row) return row; return { ...row, notes: decrypt(row.notes_encrypted), sud_history: JSON.parse(decrypt(row.sud_history_encrypted) || '[]'), notes_encrypted: undefined, sud_history_encrypted: undefined }; },
  decodeClinicalRecord(row) { if (!row) return row; return { ...row, content: JSON.parse(decrypt(row.content_encrypted) || '{}'), content_encrypted: undefined }; },
  decodePsychologicalDocument(row) { if (!row) return row; return { ...row, content: JSON.parse(decrypt(row.content_encrypted) || '{}'), content_encrypted: undefined }; },
  decodeMessage(row) { if (!row) return row; return { ...row, body: decrypt(row.body_encrypted), body_encrypted: undefined }; },
  encrypt
};
