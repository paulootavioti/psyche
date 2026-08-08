const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const initials = name => String(name).split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
const money = cents => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format((Number(cents)||0)/100);
const monthName = month => new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(`${month}-01T12:00:00Z`)).replace('.','').toUpperCase();
const appointmentStatus={pending:'Aguardando',confirmed:'Confirmado',completed:'Concluído',cancelled:'Cancelado',no_show:'Não compareceu'};

export function initDashboard({ api, navigate, showToast }) {
  let months=6,loading=false,lastData=null;
  const button=document.querySelector('#dashboardRefresh');

  const drawChart = series => {
    const max=Math.max(...series.flatMap(x=>[x.income,x.expense]),1),width=520,height=135,pad=10;
    const points=key=>series.map((item,index)=>`${pad+(index*(width-pad*2)/Math.max(series.length-1,1))},${height-(item[key]/max)*(height-20)}`).join(' ');
    const income=points('income'),expense=points('expense');
    document.querySelector('#incomeLine').setAttribute('points',income);
    document.querySelector('#expenseLine').setAttribute('points',expense);
    document.querySelector('#incomeArea').setAttribute('d',income?`M ${income.replaceAll(' ',' L ')} L ${width-pad},150 L ${pad},150 Z`:'' );
    document.querySelector('#dashboardMonths').innerHTML=series.map(x=>`<span>${monthName(x.month)}</span>`).join('');
    const totalIncome=series.reduce((sum,x)=>sum+x.income,0),totalExpense=series.reduce((sum,x)=>sum+x.expense,0);
    document.querySelector('#summaryIncome').textContent=money(totalIncome);
    document.querySelector('#summaryExpense').textContent=money(totalExpense);
    const net=document.querySelector('#summaryNet');net.textContent=money(totalIncome-totalExpense);net.classList.toggle('negative',totalIncome-totalExpense<0);
  };

  const render = data => {
    lastData=data;
    const date=new Date(`${data.date}T12:00:00`),hour=new Date().getHours(),greeting=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
    const dashboardDate=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(date);document.querySelector('#dashboardDate').textContent=dashboardDate.charAt(0).toUpperCase()+dashboardDate.slice(1);
    document.querySelector('#dashboardGreeting').textContent=`${greeting}, ${api.user?.name?.split(' ')[0]||'Carolina'}.`;
    document.querySelector('#metric-consultations').textContent=data.metrics.consultations;
    document.querySelector('#trend-consultations').innerHTML=data.metrics.consultations?`<b>${data.statuses.completed||0} concluídas</b> hoje`:'Nenhuma consulta para hoje';
    document.querySelector('#metric-patients').textContent=data.metrics.active_patients;
    document.querySelector('#trend-patients').innerHTML=`<b>+${data.metrics.new_patients}</b> novos neste mês`;
    document.querySelector('#metric-revenue').textContent=money(data.metrics.revenue_cents);
    const trend=data.metrics.revenue_trend;document.querySelector('#trend-revenue').innerHTML=trend==null?'Sem histórico comparativo':`<b>${trend>=0?'↑':'↓'} ${Math.abs(trend).toFixed(1)}%</b> sobre o mês anterior`;
    document.querySelector('#metric-occupancy').textContent=`${data.metrics.occupancy}%`;
    document.querySelector('#trend-occupancy').innerHTML=`<b>${data.metrics.consultations}/${data.metrics.capacity}</b> horários disponíveis`;

    const schedule=document.querySelector('#dashboardSchedule');document.querySelector('#dashboardAgendaCount').textContent=`${data.agenda.length} ${data.agenda.length===1?'atendimento agendado':'atendimentos agendados'}`;
    schedule.innerHTML=data.agenda.length?data.agenda.slice(0,5).map(a=>`<div class="time">${new Date(a.starts_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div><button class="appointment" data-start-session data-patient-id="${a.patient_id}" data-appointment-id="${a.id}"><div class="patient-mini"><div class="mini-avatar">${initials(a.patient_name)}</div><div><strong>${esc(a.patient_name)}</strong><small>${esc(a.modality)}${a.room?` · ${esc(a.room)}`:''} · ${esc(a.professional_name)}</small></div></div><span class="appointment-status">${appointmentStatus[a.status]||esc(a.status)}</span></button>`).join(''):'<div class="dashboard-empty"><span>✓</span><strong>Agenda livre hoje</strong><small>Use “Novo agendamento” para adicionar um atendimento.</small></div>';

    const total=data.agenda.length,completed=Number(data.statuses.completed||0),progress=total?Math.round((completed/total)*100):0,remaining=Math.max(total-completed,0);const ring=document.querySelector('#dayProgress');ring.style.setProperty('--p',`${progress}%`);document.querySelector('#dayProgressValue').textContent=`${progress}%`;document.querySelector('#dayProgressTitle').textContent=total?`${completed} de ${total} concluídas`:'Agenda sem atendimentos';document.querySelector('#dayProgressCopy').textContent=total?remaining?`Restam ${remaining} atendimentos para hoje.`:'Todos os atendimentos foram concluídos.':'Cadastre um atendimento para começar.';document.querySelector('#statusConfirmed').textContent=data.statuses.confirmed||0;document.querySelector('#statusPending').textContent=data.statuses.pending||data.statuses.awaiting||0;document.querySelector('#statusCancelled').textContent=data.statuses.cancelled||0;

    drawChart(data.finance);
    document.querySelector('#financePeriodLabel').textContent=`Receitas e despesas nos últimos ${months} meses`;
    document.querySelector('#dashboardMessages').innerHTML=data.messages.length?data.messages.map(m=>`<button class="message dashboard-message" data-dashboard-go="chat" data-conversation-id="${m.conversation_id}"><div class="mini-avatar">${initials(m.patient_name)}</div><div class="message-copy"><strong>${esc(m.patient_name)}</strong><p>${esc(m.body)}</p></div>${m.read_at?'':'<i class="unread"></i>'}<time>${new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></button>`).join(''):'<div class="dashboard-empty compact"><span>◌</span><strong>Nenhuma mensagem recente</strong><small>As novas conversas aparecerão aqui.</small></div>';

    const feedback=data.feedback,average=document.querySelector('#feedbackAverage');average.textContent=feedback.count?feedback.average.toFixed(1).replace('.',','):'—';document.querySelector('#feedbackStars').textContent=feedback.count?'★★★★★':'☆☆☆☆☆';document.querySelector('#feedbackCount').textContent=feedback.count?`Baseado em ${feedback.count} ${feedback.count===1?'avaliação':'avaliações'}`:'Nenhuma avaliação nos últimos 30 dias';const labels={5:'Excelente',4:'Bom',3:'Regular',2:'Ruim',1:'Muito ruim'};document.querySelector('#feedbackBars').innerHTML=feedback.count?[5,4,3].map(score=>{const count=feedback.distribution[score]||0,percent=Math.round((count/feedback.count)*100);return `<div class="bar-row"><span>${labels[score]}</span><div class="bar"><i style="width:${percent}%"></i></div><b>${percent}%</b></div>`;}).join(''):'<p class="feedback-empty">Envie pesquisas pós-atendimento para acompanhar a satisfação.</p>';
    document.querySelector('#apiStatus').title=`Dashboard atualizado às ${new Date(data.updated_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  };

  const load = async ({ silent=false }={}) => {
    if(loading||!api.token)return;loading=true;button.disabled=true;button.classList.add('loading');if(!silent)button.textContent='↻ Atualizando';
    try{const result=await api.dashboard({date:new Date().toISOString().slice(0,10),months});render(result.data);}
    catch(err){showToast(err.message);if(!lastData)document.querySelector('#dashboardSchedule').innerHTML='<div class="dashboard-error">Não foi possível carregar a visão geral. Tente atualizar.</div>';}
    finally{loading=false;button.disabled=false;button.classList.remove('loading');button.textContent='↻ Atualizar';}
  };

  document.querySelector('#dashboardRefresh').addEventListener('click',()=>load());
  document.querySelector('#dashboardPeriod').addEventListener('change',e=>{months=Number(e.target.value);load();});
  document.querySelector('#dashboard').addEventListener('click',e=>{const target=e.target.closest('[data-dashboard-go]');if(target)navigate(target.dataset.dashboardGo);});
  window.addEventListener('psyche:hydrated',()=>load({silent:true}));
  window.addEventListener('psyche:refresh',()=>load({silent:true}));
  return { load };
}
