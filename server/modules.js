export const moduleCatalog = Object.freeze({
  core:{name:'Administração',description:'Unidades, equipe, serviços e configurações'},
  clinical:{name:'Gestão clínica',description:'Pacientes, agenda, atendimento, prontuário e documentos'},
  finance:{name:'Gestão financeira',description:'Receitas, despesas, contas, recibos e notas fiscais'},
  inventory:{name:'Estoque',description:'Itens, saldos e movimentações por unidade'},
  communication:{name:'Comunicação',description:'Portal do paciente e mensagens seguras'},
  marketing:{name:'CRM e marketing',description:'Campanhas, relacionamento e feedback'},
  analytics:{name:'Indicadores',description:'Dashboard executivo e relatórios'},
  telehealth:{name:'Teleatendimento',description:'Atendimento mediado por tecnologia e recursos clínicos'}
});

export const planCatalog = Object.freeze({
  essential:{name:'Essencial',modules:['core','clinical','communication'],limits:{users:1,units:1,patients:300,storage_mb:1024}},
  professional:{name:'Profissional',modules:['core','clinical','finance','communication','analytics','telehealth'],limits:{users:5,units:2,patients:1500,storage_mb:5120}},
  clinic:{name:'Clínica',modules:Object.keys(moduleCatalog),limits:{users:50,units:10,patients:15000,storage_mb:51200}},
  enterprise:{name:'Enterprise',modules:Object.keys(moduleCatalog),limits:{users:null,units:null,patients:null,storage_mb:null}}
});

export const moduleForPath=path=>{
  const routes=[
    [/^\/api\/(dashboard|reports)/,'analytics'],
    [/^\/api\/(finance|payables|suppliers|receipts|invoices|billing)/,'finance'],
    [/^\/api\/inventory/,'inventory'],
    [/^\/api\/(conversations|feedback)/,'communication'],
    [/^\/api\/campaigns/,'marketing'],
    [/^\/api\/(appointments|schedule-rules|patients|clinical-sessions|psychological-documents)/,'clinical'],
    [/^\/api\/(team|roles|units|services|settings)/,'core']
  ];
  return routes.find(([pattern])=>pattern.test(path))?.[1]||null;
};

export function tenantContext(db,helpers,clinicId){
  const clinic=helpers.one(db,'SELECT id,name,created_at FROM clinics WHERE id=?',clinicId);
  const subscription=helpers.one(db,`SELECT cs.plan_key,cs.status,cs.trial_ends_at,cs.current_period_ends_at,p.name plan_name,p.modules_json,p.limits_json FROM clinic_subscriptions cs JOIN plans p ON p.key=cs.plan_key WHERE cs.clinic_id=?`,clinicId);
  if(!clinic||!subscription)return null;
  const enabled=new Set(JSON.parse(subscription.modules_json||'[]'));
  const overrides=helpers.all(db,'SELECT module_key,enabled FROM clinic_module_overrides WHERE clinic_id=?',clinicId);
  overrides.forEach(item=>item.enabled?enabled.add(item.module_key):enabled.delete(item.module_key));
  const usage={users:Number(helpers.one(db,'SELECT COUNT(*) total FROM users WHERE clinic_id=? AND active=1',clinicId).total),units:Number(helpers.one(db,'SELECT COUNT(*) total FROM units WHERE clinic_id=? AND active=1',clinicId).total),patients:Number(helpers.one(db,"SELECT COUNT(*) total FROM patients WHERE clinic_id=? AND status!='archived'",clinicId).total)};
  return{tenant:clinic,subscription:{plan_key:subscription.plan_key,plan_name:subscription.plan_name,status:subscription.status,trial_ends_at:subscription.trial_ends_at,current_period_ends_at:subscription.current_period_ends_at},modules:Object.fromEntries(Object.entries(moduleCatalog).map(([key,value])=>[key,{...value,enabled:enabled.has(key)}])),limits:JSON.parse(subscription.limits_json||'{}'),usage};
}
