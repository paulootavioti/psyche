import {beforeAll,describe,expect,it,vi} from 'vitest';

beforeAll(async()=>{
  await import('../app.js');
  await vi.waitFor(()=>expect(document.querySelector('#authScreen').classList.contains('hidden')).toBe(true));
  await vi.waitFor(()=>expect(document.querySelector('#settingsUnitList').textContent).toContain('Jardins'));
});

describe('Configurações SaaS',()=>{
  it('carrega unidades e preferências do backend',()=>{
    expect(document.querySelector('#settingsUnitList').textContent).toContain('3 consultórios');
    expect(document.querySelector('[data-setting-key="patient_portal"]').classList.contains('active')).toBe(true);
    expect(localStorage.getItem('psyche:settings')).toBeNull();
  });

  it('cria e edita uma unidade',async()=>{
    document.querySelector('#settingsAddUnit').click();
    let form=document.querySelector('#settingEditorForm');
    form.elements.name.value='Vila Mariana';form.elements.address.value='Rua Vergueiro';form.elements.rooms.value='2';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(document.querySelector('#settingsUnitList').textContent).toContain('Vila Mariana'));
    document.querySelector('[data-unit-id="units_2"]').click();form=document.querySelector('#settingEditorForm');form.elements.rooms.value='4';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(globalThis.__apiState.units[1].rooms).toBe(4));
  });

  it('cadastra serviço e valor com precisão monetária',async()=>{
    document.querySelector('[data-settings-tab="services"]').click();document.querySelector('#settingsAddService').click();
    const form=document.querySelector('#settingEditorForm');form.elements.name.value='Psicoterapia individual';form.elements.duration_minutes.value='50';form.elements.price.value='280.50';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(document.querySelector('#settingsServiceList').textContent).toContain('Psicoterapia individual'));
    expect(globalThis.__apiState.services[0].price_cents).toBe(28050);
  });

  it('persiste integrações e políticas de segurança na API',async()=>{
    document.querySelector('[data-settings-tab="integrations"]').click();document.querySelector('[data-setting-key="automatic_confirmation"]').click();
    await vi.waitFor(()=>expect(globalThis.__apiState.settings.integrations.automatic_confirmation).toBe(true));
    document.querySelector('[data-settings-tab="security"]').click();const select=document.querySelector('#sessionTimeout');select.value='240';select.dispatchEvent(new Event('change',{bubbles:true}));
    await vi.waitFor(()=>expect(globalThis.__apiState.settings.security.session_timeout_minutes).toBe(240));
  });

  it('configura regras éticas de cobrança sem bloqueio clínico automático',async()=>{
    document.querySelector('[data-settings-tab="billing"]').click();const form=document.querySelector('#billingPolicyForm');form.elements.timing.value='before_session';form.elements.grace_days.value='5';form.elements.overdue_action.value='review';form.elements.cancellation_hours.value='24';form.elements.no_show_charge_percent.value='50';form.elements.allow_clinical_override.checked=true;form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(globalThis.__apiState.settings.billing.timing).toBe('before_session'));
    expect(globalThis.__apiState.settings.billing.emergency_never_block).toBe(true);
  });
});
