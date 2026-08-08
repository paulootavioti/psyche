import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresPool } from './postgres.js';

const tableOrder=['plans','clinics','clinic_subscriptions','units','users','clinic_module_overrides','sessions','patients','patient_users','patient_sessions','patient_profiles','patient_consents','patient_documents','appointments','conversations','messages','appointment_confirmations','appointment_events','unit_schedule_rules','professional_schedule_rules','professional_availability','clinical_sessions','clinical_records','psychological_documents','services','clinic_settings','financial_entries','suppliers','accounts_payable','receipts','fiscal_invoices','inventory_items','inventory_movements','campaigns','feedback','audit_log'];
const jsonColumns=new Set(['plans.modules_json','plans.limits_json','appointment_events.details_json','clinic_settings.value_json','audit_log.metadata']);
const normalizeJson=value=>JSON.stringify(typeof value==='string'?JSON.parse(value):value);
const booleanColumns=new Set(['plans.active','units.active','users.active','clinic_module_overrides.enabled','patient_users.active','patient_consents.accepted','unit_schedule_rules.active','professional_schedule_rules.active','professional_availability.active','services.active','suppliers.active','inventory_items.active']);
const quote=name=>`"${String(name).replaceAll('"','""')}"`;

export async function transfer({sqlitePath=process.env.PSYCHE_DB_PATH||resolve('data/psyche.sqlite'),pool=postgresPool(),dryRun=process.argv.includes('--dry-run')}={}){
  const sqlite=new DatabaseSync(sqlitePath,{readOnly:true}),client=await pool.connect(),report=[];
  try{await client.query('BEGIN');await client.query("SET LOCAL row_security = off");for(const table of tableOrder){const exists=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);if(!exists)continue;const target=(await client.query('SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position',[table])).rows;if(!target.length)continue;const source=new Set(sqlite.prepare(`PRAGMA table_info(${quote(table)})`).all().map(column=>column.name)),columns=target.map(column=>column.column_name).filter(column=>source.has(column)),rows=sqlite.prepare(`SELECT ${columns.map(quote).join(',')} FROM ${quote(table)}`).all();let inserted=0;for(const row of rows){const values=columns.map(column=>{const key=`${table}.${column}`,value=row[column];if(value==null)return null;if(booleanColumns.has(key))return Boolean(value);if(jsonColumns.has(key))return normalizeJson(value);return value;}),parameters=columns.map((_,index)=>`$${index+1}`).join(',');try{await client.query(`INSERT INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES (${parameters}) ON CONFLICT DO NOTHING`,values);}catch(error){throw new Error(`Falha ao transferir ${table} (${row.id||row.key||row.clinic_id||'registro sem identificador'}): ${error.message}`,{cause:error});}inserted++;}report.push({table,source:rows.length,processed:inserted});}if(dryRun)await client.query('ROLLBACK');else await client.query('COMMIT');return report;}
  catch(error){await client.query('ROLLBACK');throw error;}
  finally{sqlite.close();client.release();await pool.end();}
}

if(process.argv[1]===fileURLToPath(import.meta.url))transfer().then(report=>process.stdout.write(`${JSON.stringify(report,null,2)}\n`)).catch(error=>{process.stderr.write(`${error.stack||error.message}\n`);process.exitCode=1;});
