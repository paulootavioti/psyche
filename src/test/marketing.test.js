import {beforeAll,describe,expect,it,vi} from 'vitest';

beforeAll(async()=>{
  await import('../app.js');
  await vi.waitFor(()=>expect(document.querySelector('#authScreen').classList.contains('hidden')).toBe(true));
  await vi.waitFor(()=>expect(document.querySelector('#campaignResultCount').textContent).toContain('0 campanhas'));
});

describe('Marketing e feedback',()=>{
  it('apresenta indicadores e estado vazio reais',async()=>{
    await vi.waitFor(()=>expect(document.querySelector('#marketingNps').textContent).toBe('0'));
    expect(document.querySelector('#campaignRows').textContent).toContain('Nenhuma campanha');
  });

  it('cria uma campanha condicionada a consentimento',async()=>{
    document.querySelector('.marketing-action').click();
    const form=document.querySelector('#campaignForm');
    form.elements.name.value='Pesquisa pós-atendimento';
    form.elements.channel.value='email';
    form.elements.audience.value='Pacientes atendidos';
    form.elements.consent.checked=true;
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(document.querySelector('#campaignRows').textContent).toContain('Pesquisa pós-atendimento'));
    expect(globalThis.__apiState.campaigns[0].status).toBe('draft');
  });

  it('ativa uma campanha e atualiza o indicador',async()=>{
    document.querySelector('[data-campaign-id]').click();
    document.querySelector('[data-campaign-status="active"]').click();
    await vi.waitFor(()=>expect(globalThis.__apiState.campaigns[0].status).toBe('active'));
    await vi.waitFor(()=>expect(document.querySelector('#marketingActive').textContent).toBe('1'));
  });

  it('registra feedback e recalcula satisfação',async()=>{
    document.querySelector('#newFeedback').click();
    const form=document.querySelector('#feedbackForm');
    form.elements.patient_id.value='pat_1';
    form.querySelector('[name="score"][value="5"]').checked=true;
    form.elements.comment.value='Atendimento acolhedor';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(globalThis.__apiState.feedback).toHaveLength(1));
    await vi.waitFor(()=>expect(document.querySelector('#marketingFeedbackList').textContent).toContain('Atendimento acolhedor'));
    expect(document.querySelector('#marketingAverage').textContent).toBe('5');
    expect(document.querySelector('#marketingPositive').textContent).toBe('100%');
  });
});
