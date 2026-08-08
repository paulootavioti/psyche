import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(async()=>{
  await import('../app.js');
  await vi.waitFor(()=>expect(document.querySelector('#metric-consultations').textContent).toBe('1'));
});

describe('Visão Geral SaaS',()=>{
  it('renders metrics returned by the dashboard API',()=>{
    expect(document.querySelector('#metric-patients').textContent).toBe('1');
    expect(document.querySelector('#metric-revenue').textContent).toContain('300');
    expect(document.querySelector('#metric-occupancy').textContent).toBe('4%');
  });

  it('renders the operational agenda and opens the clinical room',()=>{
    const appointment=document.querySelector('#dashboardSchedule [data-start-session]');
    expect(appointment.textContent).toContain('Mariana Costa');
    appointment.click();
    expect(document.querySelector('#room').classList.contains('active')).toBe(true);
  });

  it('navigates from KPI cards to their detailed modules',()=>{
    document.querySelector('[data-dashboard-go="patients"]').click();
    expect(document.querySelector('#patients').classList.contains('active')).toBe(true);
  });

  it('updates the financial period through the API',async()=>{
    const select=document.querySelector('#dashboardPeriod');
    select.value='12';select.dispatchEvent(new Event('change'));
    await vi.waitFor(()=>expect(document.querySelector('#financePeriodLabel').textContent).toContain('12 meses'));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('months=12'),expect.anything());
  });

  it('provides useful empty states for messages and feedback',()=>{
    expect(document.querySelector('#dashboardMessages').textContent).toContain('Nenhuma mensagem recente');
    expect(document.querySelector('#feedbackCount').textContent).toContain('Nenhuma avaliação');
  });

  it('manually refreshes data without duplicating the request',async()=>{
    const before=fetch.mock.calls.length;
    document.querySelector('#dashboardRefresh').click();
    await vi.waitFor(()=>expect(fetch.mock.calls.length).toBeGreaterThan(before));
    await vi.waitFor(()=>expect(document.querySelector('#dashboardRefresh').disabled).toBe(false));
  });
});
