import './styles.css';
import { api } from './api.js';
import { initBackendIntegration } from './backend-integration.js';
import { initDashboard } from './dashboard.js';
import { initAgenda } from './agenda.js';
import { initPatients } from './patients.js';
import { initTeam } from './team.js';
import { initFinance } from './finance.js';
import { initChat } from './chat.js';
import { initMarketing } from './marketing.js';
import { initReports } from './reports.js';
import { initSettings } from './settings.js';
import { inventoryTemplate, initInventory } from './inventory.js';
import { operationsTemplate, initOperations } from './operations.js';
import { payablesTemplate, initPayables } from './payables.js';
import { receiptsTemplate, initReceipts } from './receipts.js';
import { invoicesTemplate, initInvoices } from './invoices.js';
import { initClinicalRecords } from './clinical-records.js';
import { initPsychologicalDocuments } from './psychological-documents.js';
import { initPatientPortal } from './patient-portal.js';
import { initSchedules } from './schedules.js';
import { roomTemplate, teamTemplate, financeTemplate, chatTemplate, marketingTemplate, reportsTemplate, settingsTemplate, portalTemplate, enhancedDialogs, initEnhanced } from './enhanced.js';

const icon = (name) => ({
  dashboard: '⌂', calendar: '▦', patients: '♙', team: '♧', finance: '◒', payables: '▤', receipts: '▧', invoices:'▨', inventory: '▣', operations:'▦', chat: '◌', marketing: '◇', reports: '⌁', settings: '⚙', room: '◉'
}[name] || '•');

const appointments = [
  { time: '08:00', initials: 'MC', name: 'Mariana Costa', detail: 'Terapia individual · Sala 02', status: 'Confirmada', kind: '' },
  { time: '09:30', initials: 'RL', name: 'Rafael Lima', detail: 'Primeira consulta · Online', status: 'Aguardando', kind: 'cream' },
  { time: '11:00', initials: 'AS', name: 'Ana Souza', detail: 'Terapia individual · Sala 01', status: 'Confirmada', kind: 'lilac' },
  { time: '14:00', initials: 'FB', name: 'Felipe Braga', detail: 'Terapia de casal · Sala 03', status: 'Confirmada', kind: '' }
];

const patients = [
  ['Mariana Costa', 'mariana.costa@email.com', '(11) 99921-3344', 'Dra. Carolina', 'Ativo'],
  ['Rafael Lima', 'rafael.l@email.com', '(11) 98876-1020', 'Dr. Gustavo', 'Novo'],
  ['Ana Souza', 'ana.souza@email.com', '(11) 97220-8761', 'Dra. Carolina', 'Ativo'],
  ['Felipe Braga', 'felipe.b@email.com', '(11) 96761-2301', 'Dra. Helena', 'Ativo'],
  ['Laura Mendes', 'laura.m@email.com', '(11) 95513-4420', 'Dr. Gustavo', 'Inativo']
];

const nav = [
  ['dashboard','Visão geral'], ['calendar','Agenda'], ['room','Atendimento'], ['patients','Pacientes'], ['team','Equipe'], ['finance','Financeiro'], ['payables','Contas a pagar'], ['receipts','Recibos'], ['invoices','Notas fiscais'], ['inventory','Estoque'], ['operations','Salas e equipamentos'], ['chat','Comunicação'], ['marketing','Marketing'], ['reports','Relatórios']
];

function sidebar() {
  return `<aside class="sidebar" id="sidebar">
    <div class="brand"><div class="brand-mark">P</div><div class="brand-name">Psyché</div><button class="sidebar-close" id="sidebarClose" aria-label="Fechar menu">×</button></div>
    <div class="clinic-select"><div class="clinic-dot">PS</div><div><span>Unidade atual</span><strong>Psyché Saúde Jardins</strong></div><span class="chevron">⌄</span></div>
    <div class="nav-label">MENU PRINCIPAL</div>
    <nav class="nav">${nav.map(([id,label]) => `<button class="nav-item ${id === 'dashboard' ? 'active' : ''}" data-view="${id}"><span class="nav-icon">${icon(id)}</span>${label}${id === 'chat' ? '<span class="nav-badge">3</span>' : ''}</button>`).join('')}</nav>
    <div class="sidebar-footer"><div class="support-card"><strong>Precisa de ajuda?</strong>Nossa equipe está pronta para ajudar você.<button id="supportBtn">Falar com o suporte</button></div><button class="nav-item" data-view="settings"><span class="nav-icon">⚙</span>Configurações</button></div>
  </aside>`;
}

function dashboard() {
  return `<section class="module-view active" id="dashboard">
    <div class="welcome"><div><div class="eyebrow" id="dashboardDate">VISÃO GERAL</div><h1 id="dashboardGreeting">Bom dia, Carolina.</h1><p>Acompanhe os principais indicadores da sua clínica hoje.</p></div><div class="welcome-actions"><button class="secondary-btn dashboard-refresh" id="dashboardRefresh" title="Atualizar indicadores">↻ Atualizar</button><button class="primary-btn new-appointment"><span>＋</span>Novo agendamento</button></div></div>
    <div class="stats">
      ${[
        ['consultations','Consultas hoje','—','Aguardando atualização','calendar'],
        ['patients','Pacientes ativos','—','Aguardando atualização','patients'],
        ['revenue','Faturamento mensal','—','Aguardando atualização','finance'],
        ['occupancy','Taxa de ocupação','—','Aguardando atualização','reports']
      ].map(x => `<button class="card stat stat-button" data-dashboard-go="${x[4]}"><div class="stat-top"><span>${x[1]}</span><span class="stat-icon">${icon(x[4])}</span></div><div class="stat-value" id="metric-${x[0]}">${x[2]}</div><div class="trend" id="trend-${x[0]}">${x[3]}</div></button>`).join('')}
    </div>
    <div class="dashboard-grid">
      <div class="main-column">
        <div class="card panel"><div class="panel-head"><div><div class="panel-title">Agenda de hoje</div><div class="panel-sub" id="dashboardAgendaCount">Carregando agenda...</div></div><button class="date-chip" id="dashboardTodayChip" data-go="calendar">Hoje →</button></div>
          <div class="schedule" id="dashboardSchedule"><div class="dashboard-loading">Carregando atendimentos...</div></div>
          <button class="text-btn" data-go="calendar">Ver agenda completa →</button>
        </div>
        <div class="card panel"><div class="panel-head"><div><div class="panel-title">Visão financeira</div><div class="panel-sub" id="financePeriodLabel">Receitas e despesas nos últimos 6 meses</div></div><select class="date-chip" id="dashboardPeriod"><option value="6">Últimos 6 meses</option><option value="12">Últimos 12 meses</option><option value="3">Últimos 3 meses</option></select></div>
          <div class="finance-wrap"><div><div class="chart" id="dashboardChart"><svg viewBox="0 0 520 150" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#78a697" stop-opacity=".35"/><stop offset="1" stop-color="#78a697" stop-opacity="0"/></linearGradient></defs><path id="incomeArea" fill="url(#fill)"/><polyline id="incomeLine" fill="none" stroke="#467c6b" stroke-width="3"/><polyline id="expenseLine" fill="none" stroke="#e0a166" stroke-width="2" stroke-dasharray="4 4"/></svg></div><div class="months" id="dashboardMonths"></div></div><div class="finance-summary"><div><label><i class="legend" style="background:#467c6b"></i>Receitas</label><strong id="summaryIncome">—</strong></div><hr><div><label><i class="legend" style="background:#e0a166"></i>Despesas</label><strong id="summaryExpense">—</strong></div><hr><div><label>Resultado líquido</label><strong id="summaryNet" style="color:#397363">—</strong></div></div></div>
        </div>
      </div>
      <div class="side-column">
        <div class="card panel"><div class="panel-head"><div class="panel-title">Resumo do dia</div><button class="text-btn" data-dashboard-go="calendar">Detalhes</button></div><div class="today-progress"><div class="progress-ring" id="dayProgress"><strong id="dayProgressValue">0%</strong></div><div class="today-info"><strong id="dayProgressTitle">Nenhum atendimento concluído</strong><span id="dayProgressCopy">Acompanhe o andamento da agenda ao longo do dia.</span></div></div><div class="task-list"><div class="task"><span></span>Confirmadas <b id="statusConfirmed">0</b></div><div class="task"><span style="background:#dfa060"></span>Aguardando confirmação <b id="statusPending">0</b></div><div class="task"><span style="background:#b1bab6"></span>Cancelamentos <b id="statusCancelled">0</b></div></div></div>
        <div class="card panel"><div class="panel-head"><div><div class="panel-title">Mensagens recentes</div><div class="panel-sub">Central de comunicação</div></div><button class="text-btn" data-dashboard-go="chat">Ver todas</button></div><div id="dashboardMessages"><div class="dashboard-loading small">Carregando mensagens...</div></div></div>
        <div class="card panel"><div class="panel-head"><div><div class="panel-title">Satisfação dos pacientes</div><div class="panel-sub">Últimos 30 dias</div></div><button class="text-btn" data-dashboard-go="marketing">Detalhes</button></div><div id="dashboardFeedback"><div class="feedback-score"><div class="score" id="feedbackAverage">—</div><div><div class="stars" id="feedbackStars">☆☆☆☆☆</div><p id="feedbackCount">Nenhuma avaliação</p></div></div><div id="feedbackBars"></div></div></div>
      </div>
    </div>
  </section>`;
}

function moduleView(id, title, subtitle, cta, body) {
  return `<section class="module-view" id="${id}"><div class="welcome"><div><div class="eyebrow">GESTÃO PSYCHÉ</div><h1>${title}</h1><p>${subtitle}</p></div><button class="primary-btn ${id==='calendar'?'new-appointment':`${id}-action`}"><span>＋</span>${cta}</button></div>${body}</section>`;
}

const patientTable = `<div class="patient-summary"><div class="card"><span>Pacientes ativos</span><strong id="patientActive">0</strong></div><div class="card"><span>Novos neste mês</span><strong id="patientNew">0</strong></div><div class="card"><span>Inativos</span><strong id="patientInactive">0</strong></div><div class="card"><span>Total cadastrado</span><strong id="patientTotal">0</strong></div></div><div class="card data-card"><div class="toolbar patient-toolbar"><div class="search"><span>⌕</span><input id="patientSearch" placeholder="Buscar por nome, e-mail ou telefone"></div><select id="patientStatus"><option value="">Todos os status</option><option value="active">Ativos</option><option value="inactive">Inativos</option><option value="archived">Arquivados</option></select><select id="patientProfessional"><option value="">Todos os profissionais</option></select><button class="secondary-btn" id="patientExport">Exportar CSV</button></div><div class="table-wrap"><table class="table patient-table"><thead><tr><th>Paciente</th><th>Contato</th><th>Telefone</th><th>Profissional</th><th>Cadastro</th><th>Status</th><th></th></tr></thead><tbody id="patientRows"><tr><td colspan="7"><div class="dashboard-loading">Carregando pacientes...</div></td></tr></tbody></table></div><div class="table-footer"><span id="patientResultCount">0 pacientes encontrados</span><span>Selecione um paciente para abrir o perfil completo</span></div></div>`;

document.querySelector('#app').innerHTML = `<div class="app-shell">${sidebar()}<main class="main"><header class="topbar"><button class="mobile-menu" id="menuBtn">☰</button><div class="search"><span>⌕</span><input id="globalSearch" placeholder="Buscar pacientes, agenda, documentos..."></div><div class="top-actions"><span class="api-status" id="apiStatus" title="Estado da conexão com o backend">API</span><button class="role-switch role-chip" data-role="patient">Ver como paciente</button><button class="icon-btn">?</button><button class="icon-btn" id="bellBtn">♢<i class="alert-dot"></i></button><div class="profile"><div class="avatar">CM</div><div class="profile-copy"><strong>Carolina Martins</strong><span>Administradora</span></div></div><button class="logout-btn" id="logoutBtn" title="Encerrar sessão">Sair</button></div></header><div class="content">
${dashboard()}
${moduleView('calendar','Agenda','Organize atendimentos, salas e profissionais em um só lugar.','Novo agendamento',`<div class="agenda-summary"><div class="card"><span>Agendados</span><strong id="agendaTotal">0</strong></div><div class="card"><span>Confirmados</span><strong id="agendaConfirmed">0</strong></div><div class="card"><span>Concluídos</span><strong id="agendaCompleted">0</strong></div><div class="card"><span>Ocupação</span><strong id="agendaOccupancy">0%</strong></div></div><div class="card agenda-card"><div class="agenda-toolbar"><div class="agenda-navigation"><button class="icon-btn" id="agendaPrev" title="Período anterior">‹</button><button class="secondary-btn" id="agendaToday">Hoje</button><button class="icon-btn" id="agendaNext" title="Próximo período">›</button><input type="date" id="agendaDate"><div><strong id="agendaRangeTitle">Agenda</strong><span id="agendaRangeSubtitle">Carregando...</span></div></div><div class="agenda-view-switch" role="group" aria-label="Visualização da agenda"><button data-agenda-view="day" class="active">Dia</button><button data-agenda-view="week">Semana</button><button data-agenda-view="month">Mês</button></div></div><div class="agenda-filters"><div class="search agenda-search"><span>⌕</span><input id="agendaSearch" placeholder="Buscar paciente ou profissional"></div><select id="agendaProfessional"><option value="">Todos os profissionais</option></select><select id="agendaUnit"><option value="">Todas as unidades</option></select><select id="calendarFilter"><option value="">Todos os status</option><option value="pending">Aguardando</option><option value="confirmed">Confirmados</option><option value="completed">Concluídos</option><option value="cancelled">Cancelados</option><option value="no_show">Não compareceu</option></select><button class="text-btn" id="agendaClearFilters">Limpar filtros</button></div><div class="agenda-content"><div class="agenda-weekdays" id="agendaWeekdays"></div><div class="schedule agenda-schedule" id="calendarSchedule"><div class="dashboard-loading">Carregando agenda...</div></div></div></div>`)}
${roomTemplate()}
${moduleView('patients','Pacientes','Prontuários, histórico clínico e relacionamento centralizados.','Novo paciente',patientTable)}
${moduleView('team','Equipe e permissões','Gerencie colaboradores, funções e acessos com segurança.','Novo colaborador',teamTemplate())}
${moduleView('finance','Gestão financeira','Controle repasses, cobranças, receitas e despesas da clínica.','Novo lançamento',financeTemplate())}
${moduleView('inventory','Controle de estoque','Gerencie insumos, materiais, custos e reposições por unidade.','Novo item',inventoryTemplate())}
${moduleView('operations','Salas e equipamentos','Gerencie ambientes, patrimônio e manutenção preventiva da clínica.','Nova sala',operationsTemplate())}
${moduleView('payables','Contas a pagar','Controle fornecedores, vencimentos, parcelas e baixas financeiras.','Nova conta',payablesTemplate())}
${moduleView('receipts','Emissão de recibos','Documente pagamentos recebidos com numeração e verificação.','Emitir recibo',receiptsTemplate())}
${moduleView('invoices','Controle de notas fiscais','Prepare, acompanhe e concilie NFS-e com segurança.','Nova nota',invoicesTemplate())}
${moduleView('chat','Comunicação','Converse com pacientes com privacidade e cuidado.','Nova mensagem',chatTemplate())}
${moduleView('marketing','Marketing e feedback','Transforme a experiência dos pacientes em crescimento sustentável.','Nova campanha',marketingTemplate())}
${moduleView('reports','Relatórios e indicadores','Decisões melhores com dados clínicos, operacionais e financeiros.','Exportar relatório',reportsTemplate())}
${moduleView('settings','Configurações','Personalize unidades, integrações e preferências da sua conta.','Adicionar unidade',settingsTemplate())}
${portalTemplate()}
</div></main></div>
<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><div><div class="eyebrow">AGENDA</div><h2>Novo agendamento</h2></div><button class="close" id="closeModal">×</button></div><form id="appointmentForm"><div class="form-grid"><div class="field full"><label>Paciente</label><select name="patient_id" required></select></div><div class="field"><label>Data</label><input name="date" required type="date" value="2026-08-05"></div><div class="field"><label>Horário</label><input name="time" required type="time" value="15:30"></div><div class="field"><label>Profissional</label><select name="professional_id" required></select></div><div class="field"><label>Unidade</label><select name="unit_id" required></select></div><div class="field"><label>Tipo de horário</label><select name="booking_type"><option value="regular">Atendimento regular</option><option value="fitting">Encaixe</option><option value="return">Retorno</option><option value="assessment">Avaliação</option><option value="emergency">Urgência</option></select></div><div class="field"><label>Modalidade</label><select name="modality"><option value="Presencial">Presencial</option><option value="Online">Online</option></select></div><div class="field"><label>Consultório</label><input name="room" placeholder="Consultório 01"></div></div><div class="modal-actions"><button type="button" class="secondary-btn" id="cancelModal">Cancelar</button><button class="primary-btn">Confirmar agendamento</button></div></form></div></div>${enhancedDialogs()}<div class="toast" id="toast">✓ Agendamento criado com sucesso!</div>`;

const sidebarElement=document.querySelector('#sidebar');
sidebarElement.insertAdjacentHTML('afterend','<button class="sidebar-backdrop" id="sidebarBackdrop" aria-label="Fechar menu"></button>');
const menuButton=document.querySelector('#menuBtn');
menuButton.setAttribute('aria-label','Abrir menu');menuButton.setAttribute('aria-expanded','false');
const closeMenu=()=>{sidebarElement.classList.remove('open');document.body.classList.remove('menu-open');menuButton.setAttribute('aria-expanded','false');};
const openMenu=()=>{sidebarElement.classList.add('open');document.body.classList.add('menu-open');menuButton.setAttribute('aria-expanded','true');};
const modal = document.querySelector('#modal');
const localToday=()=>{const now=new Date(),offset=now.getTimezoneOffset();return new Date(now.getTime()-offset*60000).toISOString().slice(0,10);};
document.querySelector('#appointmentForm [name="date"]').value=localToday();
const toast = document.querySelector('#toast');
function showToast(message) { toast.textContent = `✓ ${message}`; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),2600); }
function navigate(id) { document.querySelectorAll('.module-view').forEach(v=>v.classList.toggle('active',v.id===id)); document.querySelectorAll('.nav-item[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===id)); closeMenu(); window.scrollTo({top:0,behavior:'smooth'}); }
document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.view)));
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.go)));
document.querySelectorAll('.new-appointment').forEach(btn=>btn.addEventListener('click',()=>modal.classList.add('open')));
['closeModal','cancelModal'].forEach(id=>document.querySelector(`#${id}`).addEventListener('click',()=>modal.classList.remove('open')));
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
document.querySelector('#appointmentForm').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));const button=e.target.querySelector('button[type="submit"],button:not([type])');button.disabled=true;try{await api.createAppointment({patient_id:data.patient_id,professional_id:data.professional_id,unit_id:data.unit_id,starts_at:new Date(`${data.date}T${data.time}:00`).toISOString(),duration_minutes:50,modality:data.modality,room:data.room,booking_type:data.booking_type});modal.classList.remove('open');showToast('Agendamento criado e confirmação enviada ao portal');window.dispatchEvent(new Event('psyche:refresh'));}catch(err){showToast(err.message);}finally{button.disabled=false;}});
menuButton.addEventListener('click',()=>sidebarElement.classList.contains('open')?closeMenu():openMenu());
document.querySelector('#sidebarClose').addEventListener('click',closeMenu);
document.querySelector('#sidebarBackdrop').addEventListener('click',closeMenu);
document.querySelector('#bellBtn').addEventListener('click',async()=>{try{const result=await api.conversationSummary(),unread=Number(result.data.unread)||0;if(unread){navigate('chat');showToast(`${unread} ${unread===1?'mensagem não lida':'mensagens não lidas'}`);}else showToast('Nenhuma nova mensagem');}catch(err){showToast(err.message);}});
document.querySelector('#supportBtn').addEventListener('click',()=>{navigate('settings');showToast('Configure o canal de suporte antes do lançamento comercial');});
document.querySelector('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const v=e.target.value.trim().toLowerCase(),destinations=[['paciente','patients'],['agenda','calendar'],['consulta','calendar'],['atendimento','room'],['equipe','team'],['colaborador','team'],['finance','finance'],['conta','payables'],['recibo','receipts'],['nota','invoices'],['estoque','inventory'],['mensagem','chat'],['comunicação','chat'],['marketing','marketing'],['relatório','reports'],['configuração','settings']];const match=destinations.find(([term])=>v.includes(term));if(match)navigate(match[1]);else showToast(v?'Nenhuma seção correspondente encontrada':'Digite o nome de uma seção');}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){modal.classList.remove('open');closeMenu();}});
const currentYear=document.querySelector('#current-year');if(currentYear)currentYear.textContent=new Date().getFullYear();
initEnhanced({ navigate, showToast, api });
initPatientPortal({api,navigate,showToast});
initSchedules({api,showToast});
const backend=initBackendIntegration({api,showToast,navigate});
initDashboard({api,showToast,navigate});
initAgenda({api,showToast,navigate});
initPatients({api,showToast,navigate});
initTeam({api,showToast,navigate});
initFinance({api,showToast});
initChat({api,showToast,navigate});
initMarketing({api,showToast});
initReports({api,showToast});
initSettings({api,showToast});
initInventory({api,showToast});
initOperations({api,showToast});
initPayables({api,showToast});
initReceipts({api,showToast});
initInvoices({api,showToast});
initClinicalRecords({api,showToast});
initPsychologicalDocuments({api,showToast});
document.querySelector('#logoutBtn').addEventListener('click',()=>backend.logout().catch(err=>showToast(err.message)));
window.addEventListener('psyche:refresh',()=>backend.hydrate().catch(err=>showToast(err.message)));
api.health().then(()=>{document.querySelector('#apiStatus').classList.add('online');document.querySelector('#apiStatus').title='Backend conectado';}).catch(()=>{document.querySelector('#apiStatus').classList.add('offline');document.querySelector('#apiStatus').title='Backend indisponível';});
