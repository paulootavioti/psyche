function Nt() {
  return `<section class="module-view" id="room">
    <div class="session-header"><div><div class="eyebrow">AMBIENTE CL\xCDNICO SEGURO</div><h1>Sala de atendimento</h1><p id="activeSessionLabel">Abra um atendimento pela Agenda para iniciar o registro</p></div><div class="session-clock"><span id="sessionTimer">00:00:00</span><button id="timerToggle">Iniciar</button><button id="timerReset" title="Reiniciar">\u21BA</button></div></div>
    <div class="session-patient-card" id="sessionPatientCard" hidden><div class="profile-avatar" id="sessionPatientAvatar">—</div><div><span>PACIENTE EM ATENDIMENTO</span><strong id="sessionPatientName">—</strong><small id="sessionPatientDetails">—</small></div><button class="secondary-btn" id="sessionPatientHistory">Abrir prontuário</button></div>
    <div class="clinical-warning">Uso exclusivo por profissional habilitado. Os utilit\xE1rios apoiam a condu\xE7\xE3o cl\xEDnica e n\xE3o automatizam decis\xF5es, diagn\xF3sticos ou protocolos.</div>
    <div class="room-layout">
      <div class="room-main">
        <div class="card stimulus-card">
          <div class="panel-head"><div><div class="panel-title">Est\xEDmulo visual bilateral</div><div class="panel-sub">Configure velocidade, amplitude, cor e tamanho de acordo com o plano terap\xEAutico</div></div><span class="secure-pill">\u25CF Sess\xE3o privada</span></div>
          <div class="stimulus-stage" id="stimulusStage"><div class="focus-guide">Mantenha os olhos na esfera</div><div class="emdr-ball" id="emdrBall"></div><div class="fullscreen-stimulus-controls" aria-label="Controles do est\xEDmulo em tela cheia"><button id="fsStimulusToggle">\u25B6 Iniciar</button><button id="fsSoundToggle">\u266A Som bilateral desligado</button><label>Volume <input id="fsVolumeRange" type="range" min="0" max="100" value="55"><b id="fsVolumeValue">55%</b></label><label>Velocidade <input id="fsSpeedRange" type="range" min="1" max="10" value="5"><b id="fsSpeedValue">5</b></label><label>Tamanho <input id="fsSizeRange" type="range" min="16" max="80" value="34"><b id="fsSizeValue">34</b></label><button id="exitFullscreenStimulus">Sair da tela cheia</button></div></div>
          <div class="stimulus-controls">
            <button class="primary-btn" id="stimulusToggle">\u25B6 Iniciar est\xEDmulo</button>
            <label>Velocidade <input id="speedRange" type="range" min="1" max="10" value="5"><b id="speedValue">5</b></label>
            <label>Tamanho <input id="sizeRange" type="range" min="16" max="80" value="34"><b id="sizeValue">34</b></label>
            <button class="secondary-btn" id="soundToggle" aria-pressed="false">\u266A Som bilateral desligado</button>
            <label>Volume <input id="volumeRange" type="range" min="0" max="100" value="55"><b id="volumeValue">55%</b></label>
            <label class="color-field">Cor <input id="colorInput" type="color" value="#77d7bb"></label>
            <button class="secondary-btn" id="fullscreenStimulus">Tela cheia</button>
          </div>
        </div>
        <div class="card panel media-panel"><div class="panel-head"><div><div class="panel-title">Biblioteca de m\xEDdia terap\xEAutica</div><div class="panel-sub">V\xEDdeos permanecem somente neste dispositivo nesta vers\xE3o</div></div><label class="upload-btn">\uFF0B Upload de v\xEDdeo<input id="videoUpload" type="file" accept="video/*" hidden></label></div><div id="mediaLibrary" class="media-library"><div class="media-empty"><span>\u25B7</span><strong>Nenhum v\xEDdeo adicionado</strong><small>Formatos aceitos: MP4, WebM e MOV</small></div></div></div>
        <div class="card panel notes-panel"><div class="panel-head"><div><div class="panel-title">Registro da sess\xE3o</div><div class="panel-sub">Rascunho cifrado e salvo automaticamente no backend</div></div><span id="saveState" class="saved-state">Aguardando atendimento</span></div><textarea id="sessionNotes" placeholder="Registre observa\xE7\xF5es cl\xEDnicas, interven\xE7\xF5es, respostas e pr\xF3ximos passos..."></textarea><div class="note-footer"><span>LGPD: acesso restrito ao prontu\xE1rio cl\xEDnico</span><button class="primary-btn" id="finishSession">Finalizar e salvar sess\xE3o</button></div></div>
      </div>
      <aside class="room-tools">
        <div class="card panel"><div class="panel-title">Monitoramento SUD</div><div class="panel-sub">Unidades subjetivas de perturba\xE7\xE3o</div><div class="sud-value"><strong id="sudValue">5</strong><span>/ 10</span></div><input id="sudRange" class="wide-range" type="range" min="0" max="10" value="5"><div class="range-labels"><span>Sem perturba\xE7\xE3o</span><span>M\xE1xima</span></div><button class="secondary-btn wide" id="recordSud">Registrar medida</button><div id="sudHistory" class="sud-history"></div></div>
        <div class="card panel"><div class="panel-title">Respira\xE7\xE3o guiada</div><div class="breathing-box"><div id="breathingOrb" class="breathing-orb"></div><strong id="breathingText">Pronto</strong><small>ciclo 4\u20134\u20136</small></div><button class="secondary-btn wide" id="breathingToggle">Iniciar exerc\xEDcio</button></div>
        <div class="card panel"><div class="panel-title">Utilit\xE1rios cl\xEDnicos</div><div class="utility-list"><button data-utility="Lugar seguro"><span>\u2302</span><div><strong>Lugar seguro</strong><small>Roteiro de estabiliza\xE7\xE3o</small></div></button><button data-utility="T\xE9cnica 5-4-3-2-1"><span>\u2726</span><div><strong>5\u20134\u20133\u20132\u20131</strong><small>Ancoragem sensorial</small></div></button><button data-utility="VOC"><span>\u25C9</span><div><strong>Escala VOC</strong><small>Validade da cogni\xE7\xE3o</small></div></button><button data-utility="Plano de seguran\xE7a"><span>\u2661</span><div><strong>Plano de seguran\xE7a</strong><small>Acesso r\xE1pido</small></div></button></div></div>
      </aside>
    </div>
  </section>`;
}
function Ft() {
  return '<div class="team-summary"><div class="card"><span>Colaboradores ativos</span><strong id="teamActive">0</strong></div><div class="card"><span>Profissionais cl\xEDnicos</span><strong id="teamProfessionals">0</strong></div><div class="card"><span>Administradores</span><strong id="teamAdmins">0</strong></div><div class="card"><span>Unidades</span><strong id="teamUnits">0</strong></div></div><div class="card data-card"><div class="toolbar team-toolbar"><div class="search"><span>\u2315</span><input id="teamSearch" placeholder="Buscar nome ou e-mail"></div><select id="teamRole"><option value="">Todas as fun\xE7\xF5es</option><option value="admin">Administradores</option><option value="professional">Profissionais cl\xEDnicos</option><option value="reception">Recep\xE7\xE3o</option><option value="finance">Financeiro</option></select><select id="teamUnit"><option value="">Todas as unidades</option></select><select id="teamStatus"><option value="">Todos os status</option><option value="true">Ativos</option><option value="false">Suspensos</option></select><button class="secondary-btn permissions-btn">Matriz de permiss\xF5es</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Colaborador</th><th>Fun\xE7\xE3o</th><th>Unidade</th><th>\xDAltimo acesso</th><th>Status</th><th></th></tr></thead><tbody id="teamRows"><tr><td colspan="6"><div class="dashboard-loading">Carregando equipe...</div></td></tr></tbody></table></div><div class="table-footer"><span id="teamResultCount">0 colaboradores</span><span>Gest\xE3o de acesso protegida por auditoria</span></div></div>';
}
function Ot() {
  return '<div class="finance-summary-cards"><div class="card"><span>Recebido no m\xEAs</span><strong id="financeReceived">R$ 0</strong></div><div class="card"><span>A receber</span><strong id="financeReceivable">R$ 0</strong></div><div class="card"><span>Despesas</span><strong id="financeExpenses">R$ 0</strong></div><div class="card"><span>Saldo realizado</span><strong id="financeBalance">R$ 0</strong></div><div class="card alert-card"><span>Em atraso</span><strong id="financeOverdue">R$ 0</strong></div></div><div class="card data-card"><div class="toolbar finance-toolbar"><input type="month" id="financeMonth"><div class="search"><span>\u2315</span><input id="financeSearch" placeholder="Buscar descri\xE7\xE3o ou paciente"></div><select id="financeType"><option value="">Receitas e despesas</option><option value="income">Receitas</option><option value="expense">Despesas</option></select><select id="financeStatus"><option value="">Todos os status</option><option value="pending">Pendentes</option><option value="paid">Pagos</option><option value="overdue">Em atraso</option><option value="void">Estornados</option></select><button class="secondary-btn" id="exportFinance">Exportar CSV</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Vencimento</th><th>Descri\xE7\xE3o</th><th>Paciente</th><th>Tipo</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody id="financeRows"><tr><td colspan="7"><div class="dashboard-loading">Carregando lan\xE7amentos...</div></td></tr></tbody></table></div><div class="table-footer"><span id="financeResultCount">0 lan\xE7amentos</span><span>Valores armazenados em centavos para precis\xE3o cont\xE1bil</span></div></div>';
}
function It() {
  return '<div class="communication-summary"><div class="card"><span>Conversas ativas</span><strong id="conversationTotal">0</strong></div><div class="card"><span>N\xE3o lidas</span><strong id="conversationUnread">0</strong></div><div class="card"><span>Mensagens hoje</span><strong id="messagesToday">0</strong></div><div class="card secure-summary"><span>Privacidade</span><strong>Criptografia ativa</strong></div></div><div class="card inbox"><aside class="conversation-list" id="conversationList"><div class="inbox-search"><span>\u2315</span><input id="conversationSearch" placeholder="Buscar paciente"><button id="mobileCloseConversations" aria-label="Fechar conversas">\xD7</button></div><div class="conversation-items" id="conversationItems"><div class="dashboard-loading small">Carregando conversas...</div></div></aside><section class="chat-window"><div class="chat-person" id="chatHeader"><button class="mobile-conversations" id="mobileOpenConversations" aria-label="Abrir conversas">\u2630</button><div class="mini-avatar" id="chatAvatar">\u2014</div><div><strong id="chatName">Selecione uma conversa</strong><span id="chatStatus">Canal protegido pela cl\xEDnica</span></div><button class="secondary-btn" id="chatPatientProfile" disabled>Ver paciente</button></div><div class="chat-messages" id="chatMessages"><div class="chat-empty"><span>\u25CC</span><strong>Suas conversas em um s\xF3 lugar</strong><small>Selecione um paciente para visualizar o hist\xF3rico protegido.</small></div></div><div class="quick-replies" id="quickReplies"><button type="button" data-quick="Ol\xE1! Como podemos ajudar?">Sauda\xE7\xE3o</button><button type="button" data-quick="Seu atendimento est\xE1 confirmado. At\xE9 breve!">Confirmar atendimento</button><button type="button" data-quick="Recebemos sua mensagem e retornaremos em breve.">Confirmar recebimento</button></div><form id="messageForm" class="message-composer"><textarea required maxlength="5000" rows="1" placeholder="Escreva uma mensagem segura..." disabled></textarea><span id="messageCount">0/5000</span><button class="primary-btn" disabled>Enviar</button></form></section></div>';
}
function jt() {
  return '<div class="marketing-summary"><div class="card"><span>NPS estimado</span><strong id="marketingNps">0</strong><small id="marketingNpsLabel">Sem avalia\xE7\xF5es</small></div><div class="card"><span>Satisfa\xE7\xE3o m\xE9dia</span><strong id="marketingAverage">\u2014</strong><small id="marketingFeedbackCount">0 respostas</small></div><div class="card"><span>Avalia\xE7\xF5es positivas</span><strong id="marketingPositive">0%</strong><small>Notas 4 e 5</small></div><div class="card"><span>Campanhas ativas</span><strong id="marketingActive">0</strong><small>Automa\xE7\xF5es em execu\xE7\xE3o</small></div></div><div class="marketing-grid"><div class="card data-card campaign-card"><div class="toolbar marketing-toolbar"><div><div class="panel-title">Campanhas e automa\xE7\xF5es</div><div class="panel-sub">Comunica\xE7\xE3o respons\xE1vel e baseada em consentimento</div></div><select id="campaignStatus"><option value="">Todos os status</option><option value="active">Ativas</option><option value="draft">Rascunhos</option><option value="paused">Pausadas</option><option value="completed">Conclu\xEDdas</option><option value="archived">Arquivadas</option></select></div><div class="table-wrap"><table class="table"><thead><tr><th>Campanha</th><th>Canal</th><th>P\xFAblico</th><th>Status</th><th></th></tr></thead><tbody id="campaignRows"><tr><td colspan="5"><div class="dashboard-loading">Carregando campanhas...</div></td></tr></tbody></table></div><div class="table-footer"><span id="campaignResultCount">0 campanhas</span><span>LGPD: envie somente para pacientes com consentimento v\xE1lido</span></div></div><aside class="card panel feedback-panel"><div class="panel-head"><div><div class="panel-title">Feedback dos pacientes</div><div class="panel-sub">\xDAltimos 30 dias</div></div><button class="secondary-btn" id="newFeedback">Registrar</button></div><div class="feedback-distribution" id="marketingDistribution"></div><div class="feedback-list" id="marketingFeedbackList"><div class="dashboard-loading small">Carregando avalia\xE7\xF5es...</div></div></aside></div>';
}
function Ht() {
  return '<div class="card report-filter"><div><div class="panel-title">Per\xEDodo do relat\xF3rio</div><div class="panel-sub" id="reportPeriodLabel">Selecione o intervalo de an\xE1lise</div></div><label>De <input type="date" id="reportFrom"></label><label>At\xE9 <input type="date" id="reportTo"></label><button class="secondary-btn" id="reportApply">Atualizar</button></div><div class="report-summary"><div class="card"><span>Atendimentos</span><strong id="reportAppointments">\u2014</strong><small id="reportCompletion">Conclus\xE3o: \u2014</small></div><div class="card"><span>Ocupa\xE7\xE3o estimada</span><strong id="reportOccupancy">\u2014</strong><small>Capacidade das unidades</small></div><div class="card"><span>Reten\xE7\xE3o no per\xEDodo</span><strong id="reportRetention">\u2014</strong><small>Pacientes com recorr\xEAncia</small></div><div class="card"><span>Ticket m\xE9dio</span><strong id="reportTicket">\u2014</strong><small>Por atendimento conclu\xEDdo</small></div><div class="card"><span>Resultado l\xEDquido</span><strong id="reportNet">\u2014</strong><small id="reportFinanceCopy">Receitas menos despesas</small></div></div><div class="report-grid"><div class="card panel report-trend"><div class="panel-head"><div><div class="panel-title">Evolu\xE7\xE3o do per\xEDodo</div><div class="panel-sub">Atendimentos realizados por data</div></div></div><div class="report-chart" id="reportChart"><div class="dashboard-loading">Carregando evolu\xE7\xE3o...</div></div></div><div class="card panel report-status"><div class="panel-head"><div><div class="panel-title">Status dos atendimentos</div><div class="panel-sub">Distribui\xE7\xE3o operacional</div></div></div><div id="reportStatuses"></div></div><div class="card data-card report-professionals"><div class="panel-head table-heading"><div><div class="panel-title">Desempenho por profissional</div><div class="panel-sub">Volume, conclus\xE3o e perdas no per\xEDodo</div></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Profissional</th><th>Agendados</th><th>Conclu\xEDdos</th><th>Perdas</th><th>Convers\xE3o</th></tr></thead><tbody id="reportProfessionalRows"><tr><td colspan="5"><div class="dashboard-loading">Carregando indicadores...</div></td></tr></tbody></table></div></div><div class="card panel report-patients"><div class="panel-title">Base de pacientes</div><div class="report-patient-metrics"><div><span>Ativos</span><strong id="reportActivePatients">\u2014</strong></div><div><span>Novos no per\xEDodo</span><strong id="reportNewPatients">\u2014</strong></div></div><p>Indicadores gerenciais n\xE3o substituem avalia\xE7\xE3o cl\xEDnica ou an\xE1lise cont\xE1bil especializada.</p></div></div>';
}
function Bt() {
  return '<div class="settings-grid"><nav class="card panel settings-nav" aria-label="Se\xE7\xF5es de configura\xE7\xF5es"><button class="active" data-settings-tab="units">Cl\xEDnica e unidades</button><button data-settings-tab="services">Servi\xE7os e valores</button><button data-settings-tab="integrations">Integra\xE7\xF5es</button><button data-settings-tab="security">Seguran\xE7a e LGPD</button><button data-settings-tab="notifications">Notifica\xE7\xF5es</button></nav><div class="settings-panels"><section class="card panel settings-panel active" data-settings-panel="units"><div class="panel-head"><div><div class="panel-title">Unidades e consult\xF3rios</div><div class="panel-sub">Estrutura f\xEDsica e capacidade operacional</div></div><button class="secondary-btn" id="settingsAddUnit">\uFF0B Unidade</button></div><div id="settingsUnitList"><div class="dashboard-loading">Carregando unidades...</div></div></section><section class="card panel settings-panel" data-settings-panel="services"><div class="panel-head"><div><div class="panel-title">Servi\xE7os e valores</div><div class="panel-sub">Cat\xE1logo utilizado na agenda e no financeiro</div></div><button class="secondary-btn" id="settingsAddService">\uFF0B Servi\xE7o</button></div><div id="settingsServiceList"><div class="dashboard-loading">Carregando servi\xE7os...</div></div></section><section class="card panel settings-panel" data-settings-panel="integrations"><div class="panel-head"><div><div class="panel-title">Integra\xE7\xF5es</div><div class="panel-sub">Recursos conectados \xE0 experi\xEAncia da cl\xEDnica</div></div></div><div class="settings-toggle-list" id="settingsIntegrations"></div></section><section class="card panel settings-panel" data-settings-panel="security"><div class="panel-head"><div><div class="panel-title">Seguran\xE7a e LGPD</div><div class="panel-sub">Pol\xEDticas de acesso, auditoria e prote\xE7\xE3o de dados</div></div></div><div class="settings-security" id="settingsSecurity"></div><div class="lgpd-note"><strong>Responsabilidade compartilhada</strong><p>A Psych\xE9 protege os dados tecnicamente. A cl\xEDnica deve manter bases legais, consentimentos, pol\xEDticas internas e profissionais autorizados.</p></div></section><section class="card panel settings-panel" data-settings-panel="notifications"><div class="panel-head"><div><div class="panel-title">Notifica\xE7\xF5es</div><div class="panel-sub">Defina quando e por quais canais a equipe ser\xE1 avisada</div></div></div><div class="settings-toggle-list" id="settingsNotifications"></div></section></div></div>';
}
function Ut() {
  return '<section class="module-view" id="portal"><div class="portal-hero"><div><span>PORTAL DO PACIENTE</span><h1>Ol\xE1, Mariana.</h1><p>Seu espa\xE7o de cuidado, documentos e comunica\xE7\xE3o com a cl\xEDnica.</p></div><button class="secondary-btn role-switch" data-role="admin">Voltar ao ambiente profissional</button></div><div class="portal-grid"><div class="card next-session"><span>PR\xD3XIMA SESS\xC3O</span><h2>Quinta, 06 de agosto</h2><p>08:00 \xB7 Dra. Carolina Martins \xB7 Online</p><button class="primary-btn" id="patientJoin">Entrar na sala</button></div><div class="card panel"><div class="panel-title">Pagamentos</div><div class="payment-item"><div><strong>Sess\xE3o \xB7 06/08</strong><span>Vence amanh\xE3</span></div><b>R$ 280,00</b><button class="secondary-btn" id="patientPay">Pagar</button></div></div><div class="card panel"><div class="panel-title">Exerc\xEDcios e materiais</div><div class="material-item"><span>\u25C9</span><div><strong>Di\xE1rio de emo\xE7\xF5es</strong><small>Enviado por Dra. Carolina</small></div><button class="material-open">\u2192</button></div><div class="material-item"><span>\u2668</span><div><strong>Respira\xE7\xE3o 4\u20134\u20136</strong><small>\xC1udio \xB7 4 minutos</small></div><button class="material-open">\u2192</button></div></div><div class="card panel"><div class="panel-title">Fale com a cl\xEDnica</div><p class="muted-copy">Envie mensagens seguras para a recep\xE7\xE3o ou para sua profissional.</p><button class="primary-btn" id="patientMessage">Nova mensagem</button></div></div></section>';
}
function zt() {
  return `<dialog id="crudDialog" class="crud-dialog"><form method="dialog" id="crudForm"><div class="modal-head"><div><div class="eyebrow" id="dialogEyebrow">CADASTRO</div><h2 id="dialogTitle">Novo cadastro</h2></div><button class="close" value="cancel">\xD7</button></div><div class="form-grid" id="dialogFields"></div><div class="modal-actions"><button class="secondary-btn" value="cancel">Cancelar</button><button class="primary-btn" id="dialogSubmit" value="default">Salvar cadastro</button></div></form></dialog><dialog id="utilityDialog" class="crud-dialog utility-dialog"><div class="modal-head"><h2 id="utilityTitle">Utilit\xE1rio cl\xEDnico</h2><button class="close" onclick="this.closest('dialog').close()">\xD7</button></div><div id="utilityContent"></div></dialog>`;
}
const _ = (o, e, d = "text", l = false, p = []) => `<div class="field ${l ? "full" : ""}"><label>${o}</label>${p.length ? `<select name="${e}" required>${p.map((y) => `<option>${y}</option>`).join("")}</select>` : `<input name="${e}" type="${d}" required>`}</div>`;
function Vt({ navigate: o, showToast: e, api: d }) {
  var Pe, pe, Te, ke, Re, Ae;
  const l = document.querySelector("#crudDialog"), p = document.querySelector("#crudForm");
  let y = "", activeProfessionals = [];
  const escapeOption = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  window.addEventListener("psyche:hydrated", (event) => {
    activeProfessionals = event.detail.team.filter((member) => member.active && ["admin", "professional"].includes(member.role));
  });
  const f = (g) => {
    y = g;
    const T = { patients: ["Novo paciente", _("Nome completo", "name") + _("CPF", "cpf") + _("E-mail", "email", "email") + _("Telefone", "phone") + _("Data de nascimento", "birth", "date") + _("Profissional respons\xE1vel", "professional", "text", false, ["Dra. Carolina Martins", "Dr. Gustavo Lima", "Dra. Helena Souza"])], team: ["Novo colaborador", _("Nome completo", "name") + _("E-mail corporativo", "email", "email") + _("Senha tempor\xE1ria", "password", "password") + _("Fun\xE7\xE3o", "role", "text", false, ["Profissional cl\xEDnico", "Recep\xE7\xE3o", "Financeiro", "Administrador"]) + _("Unidade", "unit", "text", false, ["Jardins", "Vila Mariana", "Todas"])], finance: ["Novo lan\xE7amento", _("Descri\xE7\xE3o", "description", "text", true) + _("Tipo", "type", "text", false, ["Receita", "Despesa"]) + _("Valor", "value", "number") + _("Vencimento", "date", "date") + _("Status", "status", "text", false, ["Pago", "Pendente"])], marketing: ["Nova campanha", _("Nome da campanha", "name", "text", true) + _("Canal", "channel", "text", false, ["E-mail", "WhatsApp", "Portal do paciente"]) + _("P\xFAblico", "audience", "text", false, ["Novos pacientes", "Pacientes atendidos", "Pacientes inativos"])], chat: ["Nova mensagem", _("Destinat\xE1rio", "name", "text", true) + _("Assunto", "subject", "text", true) + _("Mensagem", "message", "text", true)], settings: ["Adicionar unidade", _("Nome da unidade", "name", "text", true) + _("Endere\xE7o", "address", "text", true) + _("Quantidade de consult\xF3rios", "rooms", "number") + _("Status", "status", "text", false, ["Ativa", "Em implanta\xE7\xE3o"])] }[g];
    if (T && g === "patients") {
      const options = activeProfessionals.length
        ? activeProfessionals.map((member) => `<option value="${escapeOption(member.id)}">${escapeOption(member.name)}</option>`).join("")
        : '<option value="" disabled>Nenhum profissional ativo disponível</option>';
      T[1] = _("Nome completo", "name") + _("CPF", "cpf") + _("E-mail", "email", "email") + _("Telefone", "phone") + _("Data de nascimento", "birth", "date") + `<div class="field"><label>Profissional responsável</label><select name="professional_id" required>${options}</select></div>`;
    }
    T && (document.querySelector("#dialogTitle").textContent = T[0], document.querySelector("#dialogFields").innerHTML = T[1], l.showModal());
  };
  document.querySelectorAll(".patients-action,.team-action,.finance-action").forEach((g) => g.addEventListener("click", () => f(g.classList[1].replace("-action", "")))), p.addEventListener("submit", async (g) => {
    var T, A;
    if (((T = g.submitter) == null ? void 0 : T.value) === "cancel")
      return;
    g.preventDefault();
    const E = Object.fromEntries(new FormData(p));
    try {
      y === "patients" && await d.createPatient({ name: E.name, email: E.email, phone: E.phone, cpf: E.cpf, birth_date: E.birth, professional_id: E.professional_id }), y === "team" && (window.__psycheNewTeamMember = await d.createTeamMember({ name: E.name, email: E.email, password: E.password, role: ({ "Profissional cl\xEDnico": "professional", "Recep\xE7\xE3o": "reception", "Financeiro": "finance", "Administrador": "admin" })[E.role] || E.role })), y === "finance" && await d.createFinancialEntry({ description: E.description, type: E.type === "Receita" ? "income" : "expense", amount: Number(E.value), due_date: E.date, status: E.status === "Pago" ? "paid" : "pending" }), y === "marketing" && await d.createCampaign({ name: E.name, channel: E.channel, audience: E.audience }), l.close(), p.reset(), e("Cadastro salvo no backend"), window.dispatchEvent(new Event("psyche:refresh"));
    } catch (ve) {
      e(ve.message);
    }
  });
  let h = 0, v = null;
  const w = document.querySelector("#sessionTimer"), m = () => {
    const g = String(Math.floor(h / 3600)).padStart(2, "0"), E = String(Math.floor(h % 3600 / 60)).padStart(2, "0"), T = String(h % 60).padStart(2, "0");
    w.textContent = `${g}:${E}:${T}`;
  };
  document.querySelector("#timerToggle").addEventListener("click", (g) => {
    v ? (clearInterval(v), v = null, g.target.textContent = "Continuar") : (v = setInterval(() => {
      h++, m();
    }, 1e3), g.target.textContent = "Pausar");
  }), document.querySelector("#timerReset").addEventListener("click", () => {
    clearInterval(v), v = null, h = 0, m(), document.querySelector("#timerToggle").textContent = "Iniciar";
  });
  let S = false, q = false, c = 1, r = null;
  const s = document.querySelector("#emdrBall"), n = document.querySelector("#speedRange"), a = document.querySelector("#sizeRange"), t = document.querySelector("#volumeRange"), i = () => 2.3 - Number(n.value) * 0.18, u = () => {
    var ve, De, Me;
    if (!q || !S || !r)
      return;
    const g = r.createOscillator(), E = r.createGain(), T = (ve = r.createStereoPanner) == null ? void 0 : ve.call(r), A = r.currentTime;
    g.type = "sine", (Me = (De = g.frequency).setValueAtTime) == null || Me.call(De, 420, A), g.frequency.setValueAtTime || (g.frequency.value = 420), E.gain.setValueAtTime(0, A), E.gain.linearRampToValueAtTime(Number(t.value) / 100 * 0.32, A + 1e-3), E.gain.exponentialRampToValueAtTime(1e-4, A + 0.22), T ? (T.pan.value = c, g.connect(E), E.connect(T), T.connect(r.destination)) : (g.connect(E), E.connect(r.destination)), g.start(A), g.stop(A + 0.23), c *= -1;
  }, b = () => {
    document.querySelector("#stimulusToggle").textContent = S ? "\u2161 Pausar est\xEDmulo" : "\u25B6 Iniciar est\xEDmulo", document.querySelector("#fsStimulusToggle").textContent = S ? "\u2161 Pausar" : "\u25B6 Iniciar";
  }, $ = (g) => {
    S = g, c = 1, s.classList.toggle("running", S), b();
  }, C = (g) => {
    n.value = g, document.querySelector("#fsSpeedRange").value = g, document.querySelector("#speedValue").textContent = g, document.querySelector("#fsSpeedValue").textContent = g, s.style.animationDuration = `${i()}s`;
  }, H = (g) => {
    a.value = g, document.querySelector("#fsSizeRange").value = g, document.querySelector("#sizeValue").textContent = g, document.querySelector("#fsSizeValue").textContent = g, s.style.width = s.style.height = `${g}px`;
  }, ae = (g) => {
    t.value = g, document.querySelector("#fsVolumeRange").value = g, document.querySelector("#volumeValue").textContent = `${g}%`, document.querySelector("#fsVolumeValue").textContent = `${g}%`;
  }, k = async () => {
    var g;
    if (q)
      q = false;
    else {
      const E = window.AudioContext || window.webkitAudioContext;
      if (!E) {
        e("\xC1udio bilateral n\xE3o \xE9 compat\xEDvel com este navegador");
        return;
      }
      r || (r = new E()), await ((g = r.resume) == null ? void 0 : g.call(r)), q = true;
    }
    document.querySelectorAll("#soundToggle,#fsSoundToggle").forEach((E) => {
      E.textContent = q ? "\u266A Som bilateral ligado" : "\u266A Som bilateral desligado", E.setAttribute("aria-pressed", String(q));
    });
  };
  s.addEventListener("animationiteration", u), document.querySelectorAll("#stimulusToggle,#fsStimulusToggle").forEach((g) => g.addEventListener("click", () => $(!S))), document.querySelectorAll("#soundToggle,#fsSoundToggle").forEach((g) => g.addEventListener("click", k)), n.addEventListener("input", (g) => C(g.target.value)), document.querySelector("#fsSpeedRange").addEventListener("input", (g) => C(g.target.value)), a.addEventListener("input", (g) => H(g.target.value)), document.querySelector("#fsSizeRange").addEventListener("input", (g) => H(g.target.value)), t.addEventListener("input", (g) => ae(g.target.value)), document.querySelector("#fsVolumeRange").addEventListener("input", (g) => ae(g.target.value)), document.querySelector("#colorInput").addEventListener("input", (g) => {
    s.style.background = g.target.value, s.style.boxShadow = `0 0 30px ${g.target.value}`;
  }), document.querySelector("#fullscreenStimulus").addEventListener("click", () => {
    var g, E;
    return (E = (g = document.querySelector("#stimulusStage")).requestFullscreen) == null ? void 0 : E.call(g);
  }), document.querySelector("#exitFullscreenStimulus").addEventListener("click", () => {
    var g;
    return (g = document.exitFullscreen) == null ? void 0 : g.call(document);
  }), document.querySelector("#videoUpload").addEventListener("change", (g) => {
    const E = g.target.files[0];
    if (!E)
      return;
    if (E.size > 200 * 1024 * 1024) {
      e("O v\xEDdeo deve ter at\xE9 200 MB");
      return;
    }
    const T = URL.createObjectURL(E);
    document.querySelector("#mediaLibrary").innerHTML = `<div class="media-video"><video controls src="${T}"></video><div><strong>${E.name}</strong><span>${(E.size / 1024 / 1024).toFixed(1)} MB \xB7 arquivo local</span></div></div>`, e("V\xEDdeo adicionado \xE0 sess\xE3o");
  });
  const Q = document.querySelector("#sessionNotes"), V = document.querySelector("#saveState");
  let Se, M = null, qe = Promise.resolve();
  const ce = [], le = document.querySelector("#sudRange");
  le.addEventListener("input", () => document.querySelector("#sudValue").textContent = le.value);
  const Ze = (g) => ({ appointment_id: M.appointmentId, patient_id: M.patientId, duration_seconds: h, notes: Q.value, sud_history: ce, ...g ? { finished_at: (/* @__PURE__ */ new Date()).toISOString() } : {} }), $e = (g) => M != null && M.patientId ? (V.textContent = g ? "Finalizando..." : "Salvando...", qe = qe.catch(() => null).then(async () => {
    const E = Ze(g), T = M.sessionId ? await d.updateClinicalSession(M.sessionId, E) : await d.createClinicalSession(E);
    return M.sessionId || (M.sessionId = T.data.id), V.textContent = g ? "\u2713 Sess\xE3o finalizada" : "\u2713 Rascunho salvo", T;
  }).catch((E) => {
    if (V.textContent = "Falha ao salvar", g)
      throw E;
  }), qe) : Promise.resolve(null);
  Q.addEventListener("input", () => {
    if (!M) {
      V.textContent = "Abra um atendimento para salvar";
      return;
    }
    V.textContent = "Altera\xE7\xF5es pendentes", clearTimeout(Se), Se = setTimeout(() => $e(false), 700);
  }), document.querySelector("#recordSud").addEventListener("click", () => {
    const g = (/* @__PURE__ */ new Date()).toISOString();
    ce.push({ at: g, value: Number(le.value) }), document.querySelector("#sudHistory").insertAdjacentHTML("afterbegin", `<span>${new Date(g).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} \xB7 SUD ${le.value}</span>`), $e(false), e("Medida SUD registrada");
  }), document.querySelector("#finishSession").addEventListener("click", async () => {
    if (!(M != null && M.patientId)) {
      e("Abra o atendimento pela agenda antes de finalizar");
      return;
    }
    clearTimeout(Se);
    try {
      const g=await $e(true),E=M.patientId,T=M.sessionId||g?.data?.id,A=Q.value||"Atendimento realizado sem observações adicionais.";
      await d.createClinicalRecord(E,{session_id:T,type:"evolution",title:`Evolução do atendimento · ${new Date().toLocaleDateString("pt-BR")}`,content:{summary:A,duration_seconds:h,sud_history:[...ce]},visibility:"record",status:"completed",occurred_at:new Date().toISOString()});
      clearInterval(v), v = null, h = 0, m(), $(false), e("Sessão finalizada e evolução gravada no prontuário"), Q.value = "", ce.length = 0, document.querySelector("#sudHistory").innerHTML = "", document.querySelector("#activeSessionLabel").textContent = "Sessão finalizada · abra outro atendimento pela Agenda",document.querySelector("#sessionPatientCard").hidden=true, M = null, window.dispatchEvent(new Event("psyche:refresh"));
    } catch (g) {
      e(g.message);
    }
  });
  let ue = null, me = 0;
  const Xe = [["Inspire", 4e3], ["Segure", 4e3], ["Expire", 6e3]], _e = () => {
    const [g, E] = Xe[me];
    document.querySelector("#breathingText").textContent = g, document.querySelector("#breathingOrb").className = `breathing-orb phase-${me}`, me = (me + 1) % 3, ue = setTimeout(_e, E);
  };
  document.querySelector("#breathingToggle").addEventListener("click", (g) => {
    ue ? (clearTimeout(ue), ue = null, g.target.textContent = "Iniciar exerc\xEDcio", document.querySelector("#breathingText").textContent = "Pronto") : (_e(), g.target.textContent = "Encerrar exerc\xEDcio");
  });
  const et = { "Lugar seguro": "Convide a pessoa a evocar uma imagem associada a calma e seguran\xE7a. Explore elementos sensoriais, palavra-chave e sinais corporais, respeitando o ritmo e a janela de toler\xE2ncia.", "T\xE9cnica 5-4-3-2-1": "Nomeie 5 coisas que v\xEA, 4 que pode tocar, 3 que pode ouvir, 2 que pode cheirar e 1 que pode saborear. Observe a orienta\xE7\xE3o ao presente durante o exerc\xEDcio.", VOC: "Registre a validade da cogni\xE7\xE3o positiva em uma escala de 1 (completamente falsa) a 7 (completamente verdadeira). Use a medida no contexto do protocolo escolhido.", "Plano de seguran\xE7a": "Identifique sinais de alerta, estrat\xE9gias internas, pessoas e lugares de apoio, profissionais de refer\xEAncia e formas de reduzir acesso a meios de risco. Em emerg\xEAncia, acione a rede local apropriada." };
  document.querySelectorAll("[data-utility]").forEach((g) => g.addEventListener("click", () => {
    const E = g.dataset.utility;
    document.querySelector("#utilityTitle").textContent = E, document.querySelector("#utilityContent").innerHTML = `<p class="utility-copy">${et[E]}</p><textarea placeholder="Anota\xE7\xF5es deste utilit\xE1rio..."></textarea><button class="primary-btn" onclick="this.closest('dialog').close()">Concluir</button>`, document.querySelector("#utilityDialog").showModal();
  })),document.querySelector("#sessionPatientHistory").addEventListener("click",()=>{if(!M)return;o("patients");const g=document.querySelector("#patientSearch");g.value=document.querySelector("#sessionPatientName").textContent;g.dispatchEvent(new Event("input"));e("Paciente localizado; abra o perfil para consultar o prontuário");}), document.querySelectorAll(".role-switch").forEach((g) => g.addEventListener("click", () => {
    o(g.dataset.role === "patient" ? "portal" : "dashboard"), document.body.classList.toggle("patient-mode", g.dataset.role === "patient");
  })), document.addEventListener("click", (g) => {
    var T;
    const E = g.target.closest("[data-start-session]");
    if (E) {
      const A = ((T = E.querySelector("strong")) == null ? void 0 : T.textContent) || "Paciente";
      M = { patientId: E.dataset.patientId, appointmentId: E.dataset.appointmentId, sessionId: null }, h = 0, m(), Q.value = "", ce.length = 0, document.querySelector("#sudHistory").innerHTML = "", document.querySelector("#activeSessionLabel").textContent = `${A} · atendimento em andamento`, V.textContent = "Pronto para registrar", o("room"), e(`Atendimento de ${A} aberto`);
      d.patient(M.patientId).then(({data:p})=>{const card=document.querySelector("#sessionPatientCard");card.hidden=false;document.querySelector("#sessionPatientAvatar").textContent=String(p.name).split(" ").map(x=>x[0]).slice(0,2).join("");document.querySelector("#sessionPatientName").textContent=p.name;const age=p.birth_date?Math.max(0,new Date().getFullYear()-new Date(`${p.birth_date}T12:00`).getFullYear()):null;document.querySelector("#sessionPatientDetails").textContent=[age!==null?`${age} anos`:null,p.phone,p.professional_name].filter(Boolean).join(" · ");}).catch(g=>e(g.message));
    }
  }), (Pe = document.querySelector("#calendarFilter")) == null || Pe.addEventListener("change", (g) => {
    document.querySelectorAll("#calendarSchedule .appointment").forEach((E) => {
      const T = g.target.value === "Todos" || E.dataset.status === g.target.value;
      E.style.display = T ? "flex" : "none";
      const A = E.previousElementSibling;
      A != null && A.classList.contains("time") && (A.style.display = T ? "block" : "none");
    });
  }), (Te = (pe = document.querySelector(".team .toolbar input")) == null ? void 0 : pe.addEventListener) == null || Te.call(pe, "input", () => {
  }), (ke = document.querySelector("#patientJoin")) == null || ke.addEventListener("click", () => e("Sala dispon\xEDvel 10 minutos antes do atendimento")), (Re = document.querySelector("#patientPay")) == null || Re.addEventListener("click", () => e("Pagamento online ser\xE1 liberado ap\xF3s configurar o gateway financeiro")), (Ae = document.querySelector("#patientMessage")) == null || Ae.addEventListener("click", () => {
    document.body.classList.remove("patient-mode"), o("chat"), e("Central de mensagens aberta");
  }), document.querySelectorAll(".material-open").forEach((g) => g.addEventListener("click", () => e(`Material \u201C${g.parentElement.querySelector("strong").textContent}\u201D aberto`)));
}

export const roomTemplate=Nt;
export const teamTemplate=Ft;
export const financeTemplate=Ot;
export const chatTemplate=It;
export const marketingTemplate=jt;
export const reportsTemplate=Ht;
export const settingsTemplate=Bt;
export const portalTemplate=Ut;
export const enhancedDialogs=zt;
export const initEnhanced=Vt;
