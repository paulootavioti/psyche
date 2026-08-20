import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(async () => {
  localStorage.clear();
  await import('../app.js');
  await vi.waitFor(() => expect(document.querySelector('#authScreen').classList.contains('hidden')).toBe(true));
});

describe('Psyché integrated application', () => {
  it('renders every primary environment', () => {
    ['dashboard','calendar','room','patients','team','finance','payables','receipts','invoices','inventory','chat','marketing','reports','settings','portal']
      .forEach(id => expect(document.querySelector(`#${id}`)).toBeTruthy());
  });

  it('navigates to the clinical room from the menu', () => {
    document.querySelector('[data-view="room"]').click();
    expect(document.querySelector('#room').classList.contains('active')).toBe(true);
    expect(document.querySelector('#dashboard').classList.contains('active')).toBe(false);
  });

  it('autosaves and finalizes the encrypted clinical session workflow', async () => {
    document.querySelector('[data-view="dashboard"]').click();
    await vi.waitFor(()=>expect(document.querySelector('[data-start-session]')).toBeTruthy());
    const appointment=document.querySelector('[data-start-session]');
    appointment.click();
    expect(document.querySelector('#activeSessionLabel').textContent).toContain('Mariana Costa');
    const notes=document.querySelector('#sessionNotes');
    notes.value='Registro clínico protegido';
    notes.dispatchEvent(new Event('input'));
    await vi.waitFor(()=>expect(document.querySelector('#saveState').textContent).toContain('Rascunho salvo'),{timeout:2000});
    document.querySelector('#finishSession').click();
    await vi.waitFor(()=>expect(document.querySelector('#activeSessionLabel').textContent).toContain('Sessão finalizada'));
  });

  it('starts, pauses and resets the session timer', () => {
    vi.useFakeTimers();
    const toggle = document.querySelector('#timerToggle');
    toggle.click();
    vi.advanceTimersByTime(2100);
    expect(document.querySelector('#sessionTimer').textContent).toBe('00:00:02');
    toggle.click();
    document.querySelector('#timerReset').click();
    expect(document.querySelector('#sessionTimer').textContent).toBe('00:00:00');
    vi.useRealTimers();
  });

  it('controls the bilateral visual stimulus', () => {
    const toggle = document.querySelector('#stimulusToggle');
    toggle.click();
    expect(document.querySelector('#emdrBall').classList.contains('running')).toBe(true);
    const speed = document.querySelector('#speedRange');
    speed.value = '8';
    speed.dispatchEvent(new Event('input'));
    expect(document.querySelector('#speedValue').textContent).toBe('8');
    toggle.click();
  });

  it('keeps stimulus controls synchronized in fullscreen mode', () => {
    const speed = document.querySelector('#fsSpeedRange');
    speed.value = '7';
    speed.dispatchEvent(new Event('input'));
    expect(document.querySelector('#speedRange').value).toBe('7');
    expect(document.querySelector('#fsSpeedValue').textContent).toBe('7');

    const size = document.querySelector('#sizeRange');
    size.value = '52';
    size.dispatchEvent(new Event('input'));
    expect(document.querySelector('#fsSizeRange').value).toBe('52');
    expect(document.querySelector('#emdrBall').style.width).toBe('52px');

    const volume = document.querySelector('#fsVolumeRange');
    volume.value = '60';
    volume.dispatchEvent(new Event('input'));
    expect(document.querySelector('#volumeRange').value).toBe('60');
    expect(document.querySelector('#volumeValue').textContent).toBe('60%');
  });

  it('activates the optional bilateral audio engine', async () => {
    const parameter = () => ({ value:0, setValueAtTime:vi.fn(), linearRampToValueAtTime:vi.fn(), exponentialRampToValueAtTime:vi.fn() });
    const toneStart = vi.fn();
    window.AudioContext = class {
      constructor(){ this.currentTime=0;this.destination={}; }
      resume(){ return Promise.resolve(); }
      createOscillator(){ return { type:'',frequency:parameter(),connect:vi.fn(),start:toneStart,stop:vi.fn() }; }
      createGain(){ return { gain:parameter(),connect:vi.fn() }; }
      createStereoPanner(){ return { pan:{value:0},connect:vi.fn() }; }
    };
    document.querySelector('#soundToggle').click();
    await vi.waitFor(()=>expect(document.querySelector('#soundToggle').getAttribute('aria-pressed')).toBe('true'));
    expect(document.querySelector('#fsSoundToggle').textContent).toContain('ligado');
    document.querySelector('#stimulusToggle').click();
    document.querySelector('#emdrBall').dispatchEvent(new Event('animationiteration'));
    expect(toneStart).toHaveBeenCalledTimes(1);
    document.querySelector('#stimulusToggle').click();
    document.querySelector('#soundToggle').click();
  });

  it('opens and closes the responsive navigation drawer accessibly', () => {
    const menu = document.querySelector('#menuBtn');
    menu.click();
    expect(document.querySelector('#sidebar').classList.contains('open')).toBe(true);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    document.querySelector('#sidebarBackdrop').click();
    expect(document.querySelector('#sidebar').classList.contains('open')).toBe(false);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  it('registers a SUD measurement', () => {
    const range = document.querySelector('#sudRange');
    range.value = '7';
    range.dispatchEvent(new Event('input'));
    document.querySelector('#recordSud').click();
    expect(document.querySelector('#sudHistory').textContent).toContain('SUD 7');
  });

  it('creates and persists an appointment through the API', async () => {
    document.querySelector('.new-appointment').click();
    const form = document.querySelector('#appointmentForm');
    form.elements.patient_id.value = 'pat_1';
    form.elements.professional_id.value = 'usr_1';
    form.elements.date.value = '2026-08-05';
    form.elements.time.value = '17:00';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(()=>expect(globalThis.__apiState.appointments).toHaveLength(2));
    expect(document.querySelector('#calendarSchedule').textContent).toContain('Mariana Costa');
    expect(localStorage.getItem('psyche:appointments')).toBeNull();
  });

  it('creates a patient through the API and updates the table', async () => {
    document.querySelector('.patients-action').click();
    const form = document.querySelector('#crudForm');
    form.elements.name.value = 'Joana Ribeiro';
    form.elements.cpf.value = '00000000000';
    form.elements.email.value = 'joana@example.com';
    form.elements.phone.value = '11999999999';
    form.elements.birth.value = '1990-01-01';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: document.querySelector('#dialogSubmit') }));
    await vi.waitFor(()=>expect(document.querySelector('#patientRows').textContent).toContain('Joana Ribeiro'));
    expect(globalThis.__apiState.patients).toHaveLength(2);
    expect(localStorage.getItem('psyche:customPatients')).toBeNull();
  });

  it('offers only active clinical professionals when registering a patient', () => {
    const inactive={id:'usr_inactive',name:'Profissional removido',role:'professional',active:0};
    globalThis.__apiState.team.push(inactive);
    window.dispatchEvent(new CustomEvent('psyche:hydrated',{detail:{team:globalThis.__apiState.team,patients:globalThis.__apiState.patients,units:globalThis.__apiState.units}}));
    document.querySelector('.patients-action').click();
    const options=[...document.querySelector('#crudForm [name="professional_id"]').options];
    expect(options.map(option=>option.textContent)).toContain('Carolina Martins');
    expect(options.map(option=>option.textContent)).not.toContain('Profissional removido');
    document.querySelector('#crudDialog').close();
    globalThis.__apiState.team.pop();
  });

  it('creates collaborators and financial entries through the API', async () => {
    document.querySelector('.team-action').click();
    let form = document.querySelector('#crudForm');
    form.elements.name.value = 'Renata Alves';
    form.elements.email.value = 'renata@psyche.com';
    form.elements.password.value = 'SenhaTemporaria@2026';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: document.querySelector('#dialogSubmit') }));
    await vi.waitFor(()=>expect(document.querySelector('#teamRows').textContent).toContain('Renata Alves'));

    document.querySelector('.finance-action').click();
    form = document.querySelector('#crudForm');
    form.elements.description.value = 'Sessão de teste';
    form.elements.type.value = 'Receita';
    form.elements.value.value = '300';
    form.elements.date.value = '2026-08-05';
    form.elements.status.value = 'Pago';
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: document.querySelector('#dialogSubmit') }));
    await vi.waitFor(()=>expect(document.querySelector('#financeRows').textContent).toContain('Sessão de teste'));
    expect(globalThis.__apiState.finance.some(x => x.amount_cents === 30000)).toBe(true);
  });

  it('manages a financial entry, refreshes indicators and exports the filtered view', async()=>{
    await vi.waitFor(()=>expect(document.querySelector('#financeReceived').textContent).toContain('300'));
    const row=[...document.querySelectorAll('#financeRows .finance-row')].find(x=>x.textContent.includes('Sessão de teste'));
    row.click();
    expect(document.querySelector('#financeDetail').open).toBe(true);
    document.querySelector('[data-pay-finance]')?.click();
    await vi.waitFor(()=>expect(globalThis.__apiState.finance[0].status).toBe('paid'));
    document.querySelector('#exportFinance').click();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('sends encrypted-channel messages while settings remain server-managed', async () => {
    document.querySelector('.conversation').click();
    await new Promise(resolve=>setTimeout(resolve,0));
    const form = document.querySelector('#messageForm');
    form.querySelector('textarea').value = 'Mensagem integrada de teste';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(()=>expect(document.querySelector('#chatMessages').textContent).toContain('Mensagem integrada de teste'));
    expect(localStorage.getItem('psyche:settings')).toBeNull();
  });

  it('switches between professional and patient environments', () => {
    document.querySelector('.role-switch[data-role="patient"]').click();
    expect(document.body.classList.contains('patient-mode')).toBe(true);
    expect(document.querySelector('#portal').classList.contains('active')).toBe(true);
    document.querySelector('.role-switch[data-role="admin"]').click();
    expect(document.body.classList.contains('patient-mode')).toBe(false);
    expect(document.querySelector('#dashboard').classList.contains('active')).toBe(true);
  });
});
