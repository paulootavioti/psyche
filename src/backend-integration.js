const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const initials = name => String(name).split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
const roleName={admin:'Administrador',professional:'Profissional clínico',reception:'Recepção',finance:'Financeiro'};
const patientStatus={active:'Ativo',inactive:'Inativo',archived:'Arquivado'};
function loginTemplate() {
  return `<div class="auth-screen" id="authScreen"><div class="auth-brand"><div class="brand-mark">P</div><span>Psyché</span></div><div class="auth-card"><div class="eyebrow">ACESSO SEGURO</div><h1>Bem-vindo de volta.</h1><p>Entre com suas credenciais para acessar o ambiente da clínica.</p><form id="loginForm"><label>E-mail<input name="email" type="email" value="admin@psyche.local" autocomplete="username" required></label><label>Senha<div class="password-field"><input name="password" type="password" autocomplete="current-password" minlength="6" required><button type="button" id="togglePassword" aria-label="Mostrar senha">Mostrar</button></div></label><div class="login-options"><button type="button" id="forgotPassword">Esqueci minha senha</button></div><div class="auth-error" id="authError" role="alert" aria-live="polite"></div><button class="primary-btn" id="loginSubmit">Entrar no Psyché</button></form><small>Ambiente protegido · dados criptografados</small></div></div>`;
}

export function initBackendIntegration({ api, showToast, navigate }) {
  document.body.insertAdjacentHTML('beforeend', loginTemplate());
  const authScreen=document.querySelector('#authScreen'), form=document.querySelector('#loginForm'), error=document.querySelector('#authError');

  const moduleViews={clinical:['calendar','room','patients'],core:['team','settings'],finance:['finance','payables','receipts','invoices'],inventory:['inventory','operations'],communication:['chat'],marketing:['marketing'],analytics:['dashboard','reports']};
  const applyTenantContext=context=>{window.__psycheTenantContext=context;Object.entries(moduleViews).forEach(([module,views])=>views.forEach(view=>{const enabled=Boolean(context.modules[module]?.enabled);document.querySelectorAll(`[data-view="${view}"]`).forEach(item=>item.hidden=!enabled);const section=document.querySelector(`#${view}`);if(section){section.dataset.module=module;section.hidden=!enabled;}}));const clinicName=document.querySelector('.clinic-select strong');if(clinicName)clinicName.textContent=context.tenant.name;const plan=document.querySelector('.clinic-select span');if(plan)plan.textContent=`Plano ${context.subscription.plan_name}`;window.dispatchEvent(new CustomEvent('psyche:tenant-context',{detail:context}));};window.__psycheApplyTenantContext=applyTenantContext;
  const hydrate = async (context=window.__psycheTenantContext) => {
    const clinicalEnabled=context?.modules?.clinical?.enabled!==false;
    const [patients,team,units]=await Promise.all([clinicalEnabled?api.patients():Promise.resolve({data:[]}),api.team(),api.units()]);
    const patientRows=document.querySelector('#patientRows');
    patientRows.innerHTML=patients.data.map(p=>`<tr data-id="${p.id}"><td><div class="patient-mini"><div class="mini-avatar">${initials(p.name)}</div><strong>${esc(p.name)}</strong></div></td><td>${esc(p.email||'—')}</td><td>${esc(p.phone||'—')}</td><td>${p.professional_id===api.user?.id?'Você':'Equipe clínica'}</td><td><span class="tag">${patientStatus[p.status]||esc(p.status)}</span></td></tr>`).join('');
    const patientSelect=document.querySelector('[name="patient_id"]');if(patientSelect)patientSelect.innerHTML=patients.data.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    const professionalSelect=document.querySelector('[name="professional_id"]');if(professionalSelect)professionalSelect.innerHTML=team.data.filter(u=>['admin','professional'].includes(u.role)).map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
    const appointmentUnit=document.querySelector('#appointmentForm [name="unit_id"]');if(appointmentUnit)appointmentUnit.innerHTML=units.data.map(unit=>`<option value="${unit.id}">${esc(unit.name)}</option>`).join('');
    document.querySelector('#teamRows').innerHTML=team.data.map(u=>`<tr><td><div class="patient-mini"><div class="mini-avatar">${initials(u.name)}</div><strong>${esc(u.name)}</strong></div></td><td>${roleName[u.role]||esc(u.role)}</td><td>${esc(units.data.find(x=>x.id===u.unit_id)?.name||'Todas')}</td><td>${u.role==='admin'?'Acesso total':'Perfil '+(roleName[u.role]||esc(u.role))}</td><td><span class="tag">${u.active?'Ativo':'Inativo'}</span></td></tr>`).join('');
    window.dispatchEvent(new CustomEvent('psyche:hydrated',{detail:{patients:patients.data,team:team.data,units:units.data}}));
  };

  const authenticated = async () => {
    await api.me();
    const{data:context}=await api.platformContext();applyTenantContext(context);
    authScreen.classList.add('hidden');
    document.querySelector('.profile-copy strong').textContent=api.user.name;
    document.querySelector('.profile-copy span').textContent=roleName[api.user.role]||api.user.role;
    document.querySelector('.avatar').textContent=initials(api.user.name);
    await hydrate(context);
    document.querySelector('#apiStatus').classList.remove('offline');document.querySelector('#apiStatus').classList.add('online');
  };

  form.addEventListener('submit',async e=>{e.preventDefault();const button=document.querySelector('#loginSubmit'),data=Object.fromEntries(new FormData(form));button.disabled=true;button.textContent='Conectando...';error.textContent='';try{await api.health();button.textContent='Entrando...';await api.login(data.email,data.password);await authenticated();showToast('Acesso autorizado');}catch(err){error.textContent=err.message;}finally{button.disabled=false;button.textContent='Entrar no Psyché';}});
  document.querySelector('#togglePassword').addEventListener('click',e=>{const input=form.elements.password,show=input.type==='password';input.type=show?'text':'password';e.currentTarget.textContent=show?'Ocultar':'Mostrar';e.currentTarget.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');});
  document.querySelector('#forgotPassword').addEventListener('click',()=>{error.textContent='Solicite a redefinição de senha ao administrador da clínica.';});
  if(api.token)authenticated().catch(()=>{sessionStorage.removeItem('psyche:apiToken');api.token=null;authScreen.classList.remove('hidden');});
  else authScreen.classList.remove('hidden');

  return { hydrate, logout:async()=>{await api.logout();navigate('dashboard');authScreen.classList.remove('hidden');} };
}
