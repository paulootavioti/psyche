import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresDocumentStore } from '../document-store.js';

function fakePool(responses){const calls=[],client={query:async(sql,params)=>{calls.push([sql,params]);if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.includes('set_config')||sql.includes('pg_advisory_xact_lock'))return{rows:[]};return responses.shift()||{rows:[]};},release:()=>{}};return{calls,pool:{query:client.query,connect:async()=>client,end:async()=>{}}};}

test('public verification uses only the restricted database function',async()=>{const{pool,calls}=fakePool([{rows:[{number:'ATE-2026-000001'}]}]);const row=await postgresDocumentStore(pool).verify('ABC');assert.equal(row.number,'ATE-2026-000001');assert.match(calls[0][0],/psyche_verify_document/);});

test('document numbering is serialized per clinic, type and year',async()=>{const{pool,calls}=fakePool([{rows:[{total:2}]},{rows:[{id:'doc_3',number:'ATE-2026-000003'}]}]);const row=await postgresDocumentStore(pool).create('cln_1',{id:'doc_3',patientId:'pat_1',professionalId:'usr_1',type:'certificate',year:'2026',prefix:'ATE',verificationCode:'CODE',title:'Atestado',recipient:null,purpose:'Finalidade',contentEncrypted:'cipher',professionalName:'Dra.',professionalRegistration:'CRP 00/0000',status:'issued',issuedAt:'2026-08-07T12:00:00Z',createdAt:'2026-08-07T12:00:00Z'});assert.equal(row.number,'ATE-2026-000003');assert.ok(calls.some(([sql])=>sql.includes('pg_advisory_xact_lock')));});
