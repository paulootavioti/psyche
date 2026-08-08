import {beforeAll,describe,expect,it,vi} from 'vitest';

beforeAll(async()=>{
  await import('../app.js');
  await vi.waitFor(()=>expect(document.querySelector('#authScreen').classList.contains('hidden')).toBe(true));
  await vi.waitFor(()=>expect(document.querySelector('#reportAppointments').textContent).toBe('4'));
});

describe('Relatórios gerenciais',()=>{
  it('renderiza métricas calculadas pela API',()=>{
    expect(document.querySelector('#reportCompletion').textContent).toContain('75%');
    expect(document.querySelector('#reportOccupancy').textContent).toBe('20%');
    expect(document.querySelector('#reportRetention').textContent).toBe('50%');
    expect(document.querySelector('#reportNet').textContent).toContain('600');
  });

  it('apresenta evolução, status e produtividade profissional',()=>{
    expect(document.querySelector('#reportChart').textContent).toContain('4');
    expect(document.querySelector('#reportStatuses').textContent).toContain('Concluído');
    expect(document.querySelector('#reportProfessionalRows').textContent).toContain('Carolina Martins');
    expect(document.querySelector('#reportProfessionalRows').textContent).toContain('75%');
  });

  it('recarrega ao alterar o período',async()=>{
    document.querySelector('#reportFrom').value='2026-08-01';
    document.querySelector('#reportTo').value='2026-08-05';
    document.querySelector('#reportApply').click();
    await vi.waitFor(()=>expect(document.querySelector('#reportPeriodLabel').textContent).toContain('5 dias'));
    expect(fetch.mock.calls.some(([url])=>String(url).includes('/reports/summary?from=2026-08-01&to=2026-08-05'))).toBe(true);
  });

  it('exporta CSV com métricas e profissionais',()=>{
    document.querySelector('.reports-action').click();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
