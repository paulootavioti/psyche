import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresSessionStore } from '../session-store.js';

function fakePool(responses){const calls=[],client={query:async(sql,params)=>{calls.push([sql,params]);if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.includes('set_config'))return{rows:[]};return responses.shift()||{rows:[]};},release:()=>{}};return{calls,pool:{connect:async()=>client,end:async()=>{}}};}

test('session creation validates appointment ownership and completes it atomically',async()=>{
  const{pool,calls}=fakePool([{rows:[{id:'apt_1',patient_id:'pat_1',professional_id:'usr_1',status:'confirmed'}]},{rows:[{id:'cls_1',finished_at:'2026-08-07T13:00:00Z'}]},{rows:[]}]);
  const row=await postgresSessionStore(pool).create('cln_1',{id:'cls_1',appointmentId:'apt_1',patientId:'pat_1',professionalId:'usr_1',startedAt:'2026-08-07T12:00:00Z',finishedAt:'2026-08-07T13:00:00Z',durationSeconds:3600,notesEncrypted:'cipher',sudHistoryEncrypted:'cipher',createdAt:'2026-08-07T13:00:00Z'});
  assert.equal(row.id,'cls_1');
  assert.ok(calls.some(([sql,params])=>sql.includes('INSERT INTO clinical_sessions')&&params[1]==='cln_1'));
  assert.ok(calls.some(([sql])=>sql.includes("status='completed'")));
});

test('finished sessions are immutable',async()=>{
  const{pool}=fakePool([{rows:[{id:'cls_1',finished_at:'2026-08-07T13:00:00Z'}]}]);
  await assert.rejects(()=>postgresSessionStore(pool).update('cln_1','cls_1',{}),error=>error.status===409);
});
