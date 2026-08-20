const baseUrl = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  constructor() { this.token = sessionStorage.getItem('psyche:apiToken'); this.user = null; }
  async request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(this.token ? { authorization: `Bearer ${this.token}` } : {}), ...options.headers },
        body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
      });
    } catch {
      const local=['localhost','127.0.0.1'].includes(globalThis.location?.hostname);
      throw Object.assign(new Error(local?'Não foi possível conectar ao servidor local. Inicie o Psyché e tente novamente.':'Não foi possível conectar ao servidor. Tente novamente em alguns instantes.'), { status: 0 });
    }
    const text = await response.text();
    let payload = null;
    if (text) { try { payload=JSON.parse(text); } catch { payload={ raw:text.slice(0,200) }; } }
    if (!response.ok) {
      const message=payload?.error || (response.status>=500?'O serviço está temporariamente indisponível. Tente novamente em alguns instantes.':`A API respondeu com HTTP ${response.status}.`);
      throw Object.assign(new Error(message), { status: response.status, payload });
    }
    return payload;
  }
  health() { return this.request('/health'); }
  publicPlans() { return this.request('/public/plans'); }
  legalDocuments() { return this.request('/public/legal-documents'); }
  signup(data) { return this.request('/public/signup',{method:'POST',body:data}); }
  verifySignup(token) { return this.request('/public/signup/verify',{method:'POST',body:{token}}); }
  async login(email, password) { const result=await this.request('/auth/login',{method:'POST',body:{email,password}});this.token=result.token;this.user=result.user;sessionStorage.setItem('psyche:apiToken',result.token);return result; }
  async logout() { try { await this.request('/auth/logout',{method:'POST'}); } finally { this.token=null;sessionStorage.removeItem('psyche:apiToken'); } }
  configurePatientAccess(id,data) { return this.request(`/patients/${id}/portal-access`,{method:'POST',body:data}); }
  portalRequest(path,options={}) { const token=sessionStorage.getItem('psyche:patientToken');return fetch(`${baseUrl}/portal${path}`,{method:options.method||'GET',headers:{...(options.body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},body:options.body?JSON.stringify(options.body):undefined}).then(async response=>{const payload=response.status===204?{}:await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'Falha no portal do paciente');return payload;}); }
  async patientLogin(email,password) { const result=await this.portalRequest('/auth/login',{method:'POST',body:{email,password}});sessionStorage.setItem('psyche:patientToken',result.token);return result; }
  patientPortal() { return this.portalRequest('/me'); }
  respondAppointmentConfirmation(id,action,note='') { return this.portalRequest(`/appointments/${id}/confirmation`,{method:'PATCH',body:{action,note}}); }
  patientPortalMessages() { return this.portalRequest('/messages'); }
  sendPatientPortalMessage(body) { return this.portalRequest('/messages',{method:'POST',body:{body}}); }
  patientLogout() { sessionStorage.removeItem('psyche:patientToken'); }
  async me() { const result=await this.request('/me');this.user=result.user;return result; }
  platformContext() { return this.request('/platform/context'); }
  configureModule(moduleKey,enabled,reason='') { return this.request('/platform/modules',{method:'PATCH',body:{module_key:moduleKey,enabled,reason}}); }
  subscriptionCatalog() { return this.request('/platform/subscription/catalog'); }
  subscription() { return this.request('/platform/subscription'); }
  requestSubscriptionChange(data) { return this.request('/platform/subscription/requests',{method:'POST',body:data}); }
  dashboard({ date, months = 6 } = {}) { const query=new URLSearchParams();if(date)query.set('date',date);query.set('months',months);return this.request(`/dashboard?${query}`); }
  reports(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));return this.request(`/reports/summary${query.size?`?${query}`:''}`); }
  patients(filters='') { const query=typeof filters==='string'?new URLSearchParams(filters?{q:filters}:{}):new URLSearchParams(Object.entries(filters).filter(([,v])=>v!=null&&v!==''));return this.request(`/patients${query.size?`?${query}`:''}`); }
  createPatient(data) { return this.request('/patients',{method:'POST',body:data}); }
  patient(id) { return this.request(`/patients/${id}`); }
  updatePatient(id,data) { return this.request(`/patients/${id}`,{method:'PATCH',body:data}); }
  archivePatient(id) { return this.request(`/patients/${id}`,{method:'DELETE'}); }
  createConsent(id,data) { return this.request(`/patients/${id}/consents`,{method:'POST',body:data}); }
  clinicalRecords(id,type='') { return this.request(`/patients/${id}/clinical-records${type?`?type=${encodeURIComponent(type)}`:''}`); }
  createClinicalRecord(id,data) { return this.request(`/patients/${id}/clinical-records`,{method:'POST',body:data}); }
  psychologicalDocuments(id) { return this.request(`/patients/${id}/psychological-documents`); }
  createPsychologicalDocument(id,data) { return this.request(`/patients/${id}/psychological-documents`,{method:'POST',body:data}); }
  updatePsychologicalDocument(id,data) { return this.request(`/psychological-documents/${id}`,{method:'PATCH',body:data}); }
  billingPolicy() { return this.request('/billing/policy'); }
  appointments(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,value])=>value!=null&&value!==''));return this.request(`/appointments${query.size?`?${query}`:''}`); }
  createAppointment(data) { return this.request('/appointments',{method:'POST',body:data}); }
  sendAppointmentConfirmation(id) { return this.request(`/appointments/${id}/confirmation`,{method:'POST'}); }
  appointmentEvents(id) { return this.request(`/appointments/${id}/events`); }
  availability(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,value])=>value));return this.request(`/availability${query.size?`?${query}`:''}`); }
  openAvailability(data) { return this.request('/availability',{method:'POST',body:data}); }
  closeAvailability(id) { return this.request(`/availability/${id}`,{method:'DELETE'}); }
  scheduleRules(scope,id) { return this.request(`/schedule-rules/${scope}/${id}`); }
  updateScheduleRules(scope,id,rules) { return this.request(`/schedule-rules/${scope}/${id}`,{method:'PUT',body:{rules}}); }
  updateAppointment(id,data) { return this.request(`/appointments/${id}`,{method:'PATCH',body:data}); }
  cancelAppointment(id) { return this.request(`/appointments/${id}`,{method:'DELETE'}); }
  finance(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v!=null&&v!==''));return this.request(`/finance${query.size?`?${query}`:''}`); }
  financeSummary(month) { return this.request(`/finance/summary${month?`?month=${encodeURIComponent(month)}`:''}`); }
  createFinancialEntry(data) { return this.request('/finance',{method:'POST',body:data}); }
  updateFinancialEntry(id,data) { return this.request(`/finance/${id}`,{method:'PATCH',body:data}); }
  voidFinancialEntry(id) { return this.request(`/finance/${id}`,{method:'DELETE'}); }
  team(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v!=null&&v!==''));return this.request(`/team${query.size?`?${query}`:''}`); }
  createTeamMember(data) { return this.request('/team',{method:'POST',body:data}); }
  teamMember(id) { return this.request(`/team/${id}`); }
  updateTeamMember(id,data) { return this.request(`/team/${id}`,{method:'PATCH',body:data}); }
  resetTeamPassword(id,temporaryPassword) { return this.request(`/team/${id}/reset-password`,{method:'POST',body:{temporary_password:temporaryPassword}}); }
  roles() { return this.request('/roles'); }
  units() { return this.request('/units'); }
  createUnit(data) { return this.request('/units',{method:'POST',body:data}); }
  updateUnit(id,data) { return this.request(`/units/${id}`,{method:'PATCH',body:data}); }
  services() { return this.request('/services'); }
  createService(data) { return this.request('/services',{method:'POST',body:data}); }
  updateService(id,data) { return this.request(`/services/${id}`,{method:'PATCH',body:data}); }
  settings() { return this.request('/settings'); }
  updateSettings(data) { return this.request('/settings',{method:'PATCH',body:data}); }
  inventory(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''&&v!=null));return this.request(`/inventory${query.size?`?${query}`:''}`); }
  inventorySummary() { return this.request('/inventory/summary'); }
  createInventoryItem(data) { return this.request('/inventory',{method:'POST',body:data}); }
  updateInventoryItem(id,data) { return this.request(`/inventory/${id}`,{method:'PATCH',body:data}); }
  inventoryMovements(id) { return this.request(`/inventory/${id}/movements`); }
  createInventoryMovement(id,data) { return this.request(`/inventory/${id}/movements`,{method:'POST',body:data}); }
  rooms(filters={}) { const q=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));return this.request(`/rooms${q.size?`?${q}`:''}`); }
  createRoom(data) { return this.request('/rooms',{method:'POST',body:data}); }
  equipment(filters={}) { const q=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));return this.request(`/equipment${q.size?`?${q}`:''}`); }
  createEquipment(data) { return this.request('/equipment',{method:'POST',body:data}); }
  maintenance(filters={}) { const q=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));return this.request(`/maintenance${q.size?`?${q}`:''}`); }
  createMaintenance(data) { return this.request('/maintenance',{method:'POST',body:data}); }
  suppliers() { return this.request('/suppliers'); }
  createSupplier(data) { return this.request('/suppliers',{method:'POST',body:data}); }
  payables(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''&&v!=null));return this.request(`/payables${query.size?`?${query}`:''}`); }
  payablesSummary(month) { return this.request(`/payables/summary${month?`?month=${month}`:''}`); }
  createPayable(data) { return this.request('/payables',{method:'POST',body:data}); }
  updatePayable(id,data) { return this.request(`/payables/${id}`,{method:'PATCH',body:data}); }
  receipts(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));return this.request(`/receipts${query.size?`?${query}`:''}`); }
  receiptsSummary(year) { return this.request(`/receipts/summary${year?`?year=${year}`:''}`); }
  receipt(id) { return this.request(`/receipts/${id}`); }
  createReceipt(data) { return this.request('/receipts',{method:'POST',body:data}); }
  cancelReceipt(id,reason) { return this.request(`/receipts/${id}`,{method:'PATCH',body:{cancellation_reason:reason}}); }
  invoices(filters={}) { const q=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));return this.request(`/invoices${q.size?`?${q}`:''}`); }
  invoicesSummary(year) { return this.request(`/invoices/summary?year=${year}`); }
  createInvoice(data) { return this.request('/invoices',{method:'POST',body:data}); }
  updateInvoice(id,data) { return this.request(`/invoices/${id}`,{method:'PATCH',body:data}); }
  campaigns() { return this.request('/campaigns'); }
  createCampaign(data) { return this.request('/campaigns',{method:'POST',body:data}); }
  updateCampaign(id,data) { return this.request(`/campaigns/${id}`,{method:'PATCH',body:data}); }
  archiveCampaign(id) { return this.request(`/campaigns/${id}`,{method:'DELETE'}); }
  feedback() { return this.request('/feedback'); }
  feedbackSummary(days=30) { return this.request(`/feedback/summary?days=${days}`); }
  createFeedback(data) { return this.request('/feedback',{method:'POST',body:data}); }
  conversations(filters={}) { const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v!=null&&v!==''));return this.request(`/conversations${query.size?`?${query}`:''}`); }
  conversationSummary() { return this.request('/conversations/summary'); }
  createConversation(patientId) { return this.request('/conversations',{method:'POST',body:{patient_id:patientId}}); }
  messages(conversationId) { return this.request(`/conversations/${conversationId}/messages`); }
  sendMessage(conversationId,body) { return this.request(`/conversations/${conversationId}/messages`,{method:'POST',body:{body}}); }
  markConversationRead(conversationId) { return this.request(`/conversations/${conversationId}/read`,{method:'PATCH'}); }
  createClinicalSession(data) { return this.request('/clinical-sessions',{method:'POST',body:data}); }
  updateClinicalSession(id,data) { return this.request(`/clinical-sessions/${id}`,{method:'PATCH',body:data}); }
}

export const api = new ApiClient();
