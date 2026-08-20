import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailService } from '../email-service.js';

test('email service remains disabled without production credentials',()=>{
  assert.equal(createEmailService({provider:'resend',apiKey:'',from:''}).configured,false);
});

test('signup verification email is idempotent and contains no password',async()=>{
  const calls=[],service=createEmailService({provider:'resend',apiKey:'secret',from:'Psyché <contato@example.com>',fetchImpl:async(url,options)=>{calls.push([url,options]);return new Response(JSON.stringify({id:'email_1'}),{status:200,headers:{'content-type':'application/json'}});}});
  const result=await service.sendSignupVerification({id:'sgn_1',to:'ana@example.com',name:'Ana Souza',clinicName:'Clínica Ana',verificationUrl:'https://psyche.example/cadastro/verificar?token=secret-token',expiresAt:'2026-08-12T12:00:00Z'});
  assert.equal(result.id,'email_1');
  assert.equal(calls[0][1].headers['idempotency-key'],'psyche-signup-sgn_1');
  const body=JSON.parse(calls[0][1].body);
  assert.match(body.html,/Confirmar meu cadastro/);
  assert.match(body.text,/secret-token/);
  assert.doesNotMatch(body.html,/senha/i);
});

test('provider errors are translated without exposing its response',async()=>{
  const service=createEmailService({provider:'resend',apiKey:'secret',from:'contato@example.com',fetchImpl:async()=>new Response(JSON.stringify({message:'sensitive provider detail'}),{status:422})});
  await assert.rejects(()=>service.sendSignupVerification({id:'sgn_1',to:'ana@example.com',name:'Ana',clinicName:'Clínica',verificationUrl:'https://example.com/token',expiresAt:'2026-08-12T12:00:00Z'}),/Não foi possível enviar/);
});
