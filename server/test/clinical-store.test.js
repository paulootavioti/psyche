import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresClinicalStore } from '../clinical-store.js';

function fakePool(responses){const calls=[],client={query:async(sql,params)=>{calls.push([sql,params]);if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.includes('set_config')||sql.includes('pg_advisory_xact_lock'))return{rows:[]};return responses.shift()||{rows:[]};},release:()=>{}};return{calls,pool:{connect:async()=>client,end:async()=>{}}};}

test('clinical record listing applies tenant, patient and restricted visibility scopes',async()=>{
  const{pool,calls}=fakePool([{rows:[{id:'rec_1'}]}]);
  const rows=await postgresClinicalStore(pool).listRecords('cln_one','pat_one',{type:'anamnesis',actorRole:'professional',actorId:'usr_one'});
  assert.equal(rows.length,1);
  const query=calls.find(([sql])=>sql.includes('FROM clinical_records r'));
  assert.match(query[0],/r\.clinic_id=\$2/);
  assert.match(query[0],/r\.visibility='record' OR r\.professional_id=\$4/);
  assert.deepEqual(query[1],['pat_one','cln_one','anamnesis','usr_one']);
});

test('clinical record creation serializes version allocation with an advisory lock',async()=>{
  const{pool,calls}=fakePool([{rows:[{version:3}]},{rows:[{id:'rec_3',version:3}]}]);
  const record=await postgresClinicalStore(pool).createRecord('cln_one',{id:'rec_3',patientId:'pat_one',professionalId:'usr_one',sessionId:null,type:'evolution',title:'Evolução',contentEncrypted:'cipher',visibility:'record',status:'active',occurredAt:'2026-08-07T12:00:00Z',createdAt:'2026-08-07T12:00:00Z'});
  assert.equal(record.version,3);
  assert.ok(calls.some(([sql])=>sql.includes('pg_advisory_xact_lock')));
  assert.ok(calls.some(([sql,params])=>sql.includes('INSERT INTO clinical_records')&&params[1]==='cln_one'&&params[10]===3));
});
