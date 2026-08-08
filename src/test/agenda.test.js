import { beforeAll,describe,expect,it,vi } from 'vitest';

beforeAll(async()=>{await import('../app.js');await vi.waitFor(()=>expect(document.querySelector('#agendaTotal').textContent).toBe('1'));});

describe('Agenda SaaS',()=>{
  it('loads appointments and operational counters from the API',()=>{
    expect(document.querySelector('#calendarSchedule').textContent).toContain('Mariana Costa');
    expect(document.querySelector('#agendaConfirmed').textContent).toBe('1');
    expect(document.querySelector('#agendaRangeTitle').textContent).not.toMatch(/\bDe\b/);
  });

  it('sends a confirmation reminder and signals it in the agenda',async()=>{
    document.querySelector('[data-appointment-detail="apt_1"]').click();
    document.querySelector('[data-send-confirmation]').click();
    await vi.waitFor(()=>expect(globalThis.__apiState.appointments[0].confirmation_status).toBe('pending'));
    await vi.waitFor(()=>expect(document.querySelector('.confirmation-badge.pending')).toBeTruthy());
    expect(globalThis.__apiState.messages.at(-1).body).toContain('Confirme');
  });

  it('switches between day, week and month views',async()=>{
    document.querySelector('[data-agenda-view="week"]').click();
    await vi.waitFor(()=>expect(document.querySelector('#agendaRangeSubtitle').textContent).toBe('Visão semanal'));
    expect(document.querySelectorAll('#agendaWeekdays button')).toHaveLength(7);
    document.querySelector('[data-agenda-view="month"]').click();
    await vi.waitFor(()=>expect(document.querySelector('#agendaRangeSubtitle').textContent).toBe('Visão mensal'));
    expect(document.querySelectorAll('#agendaWeekdays button').length).toBeGreaterThanOrEqual(28);
  });

  it('applies status and search filters to the API',async()=>{
    const status=document.querySelector('#calendarFilter');status.value='confirmed';status.dispatchEvent(new Event('change'));
    await vi.waitFor(()=>expect(fetch).toHaveBeenCalledWith(expect.stringContaining('status=confirmed'),expect.anything()));
    const search=document.querySelector('#agendaSearch');search.value='Mariana';search.dispatchEvent(new Event('input'));
    await new Promise(resolve=>setTimeout(resolve,350));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('q=Mariana'),expect.anything());
  });

  it('opens appointment details and updates status',async()=>{
    document.querySelector('#agendaClearFilters').click();
    await vi.waitFor(()=>expect(document.querySelector('[data-appointment-detail]')).toBeTruthy());
    document.querySelector('[data-appointment-detail]').click();
    expect(document.querySelector('#appointmentDetail').open).toBe(true);
    document.querySelector('[data-status-action="completed"]').click();
    await vi.waitFor(()=>expect(globalThis.__apiState.appointments[0].status).toBe('completed'));
    await vi.waitFor(()=>expect(document.querySelector('#appointmentDetail').open).toBe(false));
  });

  it('opens the rescheduling options only after clicking Reagendar',async()=>{
    globalThis.__apiState.appointments[0].status='confirmed';window.dispatchEvent(new Event('psyche:refresh'));
    await vi.waitFor(()=>expect(document.querySelector('[data-appointment-detail]')).toBeTruthy());
    document.querySelector('[data-appointment-detail]').click();
    const form=document.querySelector('#rescheduleForm');expect(form.hidden).toBe(true);
    document.querySelector('[data-open-reschedule]').click();expect(form.hidden).toBe(false);
    form.elements.date.value='2026-08-12';form.elements.time.value='14:30';form.elements.duration.value='60';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(globalThis.__apiState.appointments[0].duration_minutes).toBe(60));
    expect(globalThis.__apiState.appointments[0].starts_at).toContain('2026-08-12');
  });

  it('reopens details and cancels without deleting history',async()=>{
    globalThis.__apiState.appointments[0].status='confirmed';window.dispatchEvent(new Event('psyche:refresh'));
    await vi.waitFor(()=>expect(document.querySelector('[data-appointment-detail]')).toBeTruthy());
    document.querySelector('[data-appointment-detail]').click();document.querySelector('[data-cancel-appointment]').click();
    await vi.waitFor(()=>expect(globalThis.__apiState.appointments[0].status).toBe('cancelled'));
    expect(confirm).toHaveBeenCalled();
  });
});
