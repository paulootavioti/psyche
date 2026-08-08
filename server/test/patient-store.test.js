import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresPatientStore } from '../patient-store.js';

function fakePool(responses){
  const calls=[],client={query:async(sql,params)=>{calls.push([sql,params]);if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.includes('set_config'))return{rows:[]};return responses.shift()||{rows:[]};},release:()=>{}};
  return{calls,pool:{connect:async()=>client,end:async()=>{}}};
}

test('patient listing is tenant-scoped and restricts professionals to their patients',async()=>{
  const{pool,calls}=fakePool([{rows:[{total:1}]},{rows:[{id:'pat_1',name:'Ana'}]}]);
  const result=await postgresPatientStore(pool).list('cln_one',{q:'Ana',actorRole:'professional',actorId:'usr_one'});
  assert.equal(result.meta.total,1);
  const queries=calls.filter(([sql])=>sql.includes('FROM patients'));
  assert.equal(queries.length,2);
  assert.ok(queries.every(([sql,params])=>sql.includes('clinic_id=$1')&&params.includes('cln_one')&&params.includes('usr_one')));
});

test('patient creation runs inside tenant context and returns only safe fields',async()=>{
  const expected={id:'pat_new',name:'Ana',email:'ana@example.com'};
  const{pool,calls}=fakePool([{rows:[expected]}]);
  const result=await postgresPatientStore(pool).create('cln_one',{id:'pat_new',professionalId:null,name:'Ana',email:'ana@example.com',phone:null,cpfEncrypted:'encrypted',birthDate:null,createdAt:'2026-08-07T12:00:00.000Z'});
  assert.deepEqual(result,expected);
  const insert=calls.find(([sql])=>sql.includes('INSERT INTO patients'));
  assert.ok(insert);
  assert.equal(insert[1][1],'cln_one');
  assert.doesNotMatch(insert[0],/RETURNING \*/);
});

test('patient detail joins profile under tenant and professional scope',async()=>{
  const{pool,calls}=fakePool([{rows:[{id:'pat_1',gender:'feminino',emergency_name_encrypted:'ciphertext'}]}]);
  const patient=await postgresPatientStore(pool).get('cln_one','pat_1',{actorRole:'professional',actorId:'usr_one'});
  assert.equal(patient.id,'pat_1');
  const query=calls.find(([sql])=>sql.includes('LEFT JOIN patient_profiles'));
  assert.match(query[0],/p\.clinic_id=\$2/);
  assert.match(query[0],/p\.professional_id=\$3/);
  assert.deepEqual(query[1],['pat_1','cln_one','usr_one']);
});

test('patient update and consent creation remain tenant-scoped',async()=>{
  const{pool,calls}=fakePool([{rows:[{id:'pat_1',name:'Ana'}]},{rows:[]},{rows:[{id:'cns_1',accepted:true}]}]);
  const store=postgresPatientStore(pool),updatedAt='2026-08-07T12:00:00.000Z';
  await store.update('cln_one','pat_1',{name:'Ana',email:null,phone:null,birthDate:null,status:'active',professionalId:null,updatedAt},{gender:null,occupation:null,emergencyNameEncrypted:'cipher',emergencyPhoneEncrypted:'cipher',addressEncrypted:'cipher'});
  const consent=await store.addConsent('cln_one',{id:'cns_1',patientId:'pat_1',type:'LGPD',accepted:true,acceptedAt:updatedAt,expiresAt:null,createdAt:updatedAt});
  assert.equal(consent.id,'cns_1');
  assert.ok(calls.some(([sql,params])=>sql.includes('UPDATE patients')&&params[1]==='cln_one'));
  assert.ok(calls.some(([sql,params])=>sql.includes('INSERT INTO patient_profiles')&&params[1]==='cln_one'));
  assert.ok(calls.some(([sql,params])=>sql.includes('INSERT INTO patient_consents')&&params[1]==='cln_one'));
});
