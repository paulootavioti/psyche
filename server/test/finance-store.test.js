import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresFinanceStore } from '../finance-store.js';

function fakePool(responses){const calls=[],client={query:async(sql,params)=>{calls.push([sql,params]);if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.includes('set_config'))return{rows:[]};return responses.shift()||{rows:[]};},release:()=>{}};return{calls,pool:{connect:async()=>client,end:async()=>{}}};}

test('financial summary keeps monetary values in integer cents',async()=>{const{pool}=fakePool([{rows:[{type:'income',status:'paid',total:'12550',count:2},{type:'expense',status:'paid',total:'3000',count:1}]}]);const summary=await postgresFinanceStore(pool).summary('cln_1','2026-08');assert.equal(summary.received_cents,12550);assert.equal(summary.expenses_cents,3000);assert.equal(summary.balance_cents,9550);});

test('financial listing scopes every filter to the tenant',async()=>{const{pool,calls}=fakePool([{rows:[]}]);await postgresFinanceStore(pool).list('cln_1',{type:'income',status:'paid',q:'Ana'});const query=calls.find(([sql])=>sql.includes('FROM financial_entries f'));assert.match(query[0],/f\.clinic_id=\$1/);assert.deepEqual(query[1],['cln_1','income','paid','%Ana%']);});

test('financial creation validates patient in the same tenant',async()=>{const{pool,calls}=fakePool([{rows:[{id:'pat_1'}]},{rows:[{id:'fin_1',amount_cents:'10000'}]}]);const row=await postgresFinanceStore(pool).create('cln_1',{id:'fin_1',patientId:'pat_1',appointmentId:null,description:'Sessão',type:'income',amountCents:10000,dueDate:'2026-08-07',status:'pending',createdAt:'2026-08-07T12:00:00Z'});assert.equal(row.id,'fin_1');assert.ok(calls.some(([sql,params])=>sql.includes('INSERT INTO financial_entries')&&params[1]==='cln_1'&&params[6]===10000));});
