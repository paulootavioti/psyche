import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresAuthStore } from '../auth-store.js';

test('PostgreSQL identity lookup uses the restricted login function',async()=>{
  const calls=[];
  const expected={id:'usr_admin',clinic_id:'cln_default',email:'admin@psyche.local'};
  const pool={
    query:async(sql,params)=>{calls.push([sql,params]);return{rows:[expected]};},
    end:async()=>{calls.push(['end']);}
  };
  const store=postgresAuthStore(pool);
  assert.equal(store.kind,'postgres');
  assert.deepEqual(await store.findUser('admin@psyche.local'),expected);
  assert.match(calls[0][0],/psyche_login_identity\(\$1\)/);
  assert.deepEqual(calls[0][1],['admin@psyche.local']);
  await store.close();
  assert.deepEqual(calls.at(-1),['end']);
});

test('PostgreSQL identity lookup returns null for an unknown account',async()=>{
  const pool={query:async()=>({rows:[]}),end:async()=>{}};
  assert.equal(await postgresAuthStore(pool).findUser('missing@example.com'),null);
});

test('PostgreSQL readiness executes a real database query',async()=>{
  const calls=[];
  const pool={query:async sql=>{calls.push(sql);return{rows:[{connected:1}]}},end:async()=>{}};
  assert.equal(await postgresAuthStore(pool).health(),true);
  assert.match(calls[0],/SELECT 1 AS connected/);
});
