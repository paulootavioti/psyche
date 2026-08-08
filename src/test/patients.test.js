import {beforeAll,describe,expect,it,vi} from 'vitest';

beforeAll(async()=>{await import('../app.js');await vi.waitFor(()=>expect(document.querySelector('#patientRows').textContent).toContain('Mariana Costa'));});

describe('Gestão de Pacientes SaaS',()=>{
  it('renders indicators and the integrated patient list',()=>{
    expect(document.querySelector('#patientActive').textContent).toBe('1');
    expect(document.querySelector('#patientTotal').textContent).toBe('1');
    expect(document.querySelector('#patientRows [data-patient-id="pat_1"]')).toBeTruthy();
  });

  it('filters patients through the API',async()=>{
    const status=document.querySelector('#patientStatus');status.value='active';status.dispatchEvent(new Event('change'));
    await vi.waitFor(()=>expect(fetch).toHaveBeenCalledWith(expect.stringContaining('status=active'),expect.anything()));
    const search=document.querySelector('#patientSearch');search.value='Mariana';search.dispatchEvent(new Event('input'));await new Promise(r=>setTimeout(r,350));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('q=Mariana'),expect.anything());
  });

  it('opens the complete profile and navigates between tabs',async()=>{
    document.querySelector('#patientRows [data-patient-id="pat_1"]').click();
    await vi.waitFor(()=>expect(document.querySelector('#patientProfile').open).toBe(true));
    await vi.waitFor(()=>expect(document.querySelector('#patientProfileContent').textContent).toContain('Contato de emergência'));
    expect(document.querySelector('#patientProfileContent').textContent).toContain('José Costa');
    document.querySelector('[data-profile-tab="history"]').click();
    expect(document.querySelector('#profileTabContent').textContent).toContain('Online');
    document.querySelector('[data-profile-tab="finance"]').click();
    expect(document.querySelector('#profileTabContent').textContent).toContain('300');
  });

  it('creates a versioned anamnesis in the encrypted clinical record',async()=>{
    await vi.waitFor(()=>expect(document.querySelector('#openClinicalRecord')).toBeTruthy());
    document.querySelector('#openClinicalRecord').click();
    await vi.waitFor(()=>expect(document.querySelector('#clinicalRecordDialog').open).toBe(true));
    document.querySelector('#newClinicalRecord').click();
    const form=document.querySelector('#clinicalRecordForm');
    form.elements.title.value='Anamnese inicial';form.elements.demand.value='Demanda inicial para acompanhamento';form.elements.support_network.value='Rede familiar presente';
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(globalThis.__apiState.clinicalRecords).toHaveLength(1));
    await vi.waitFor(()=>expect(document.querySelector('#clinicalRecordList').textContent).toContain('Demanda inicial'));
    expect(globalThis.__apiState.clinicalRecords[0].type).toBe('anamnesis');
    document.querySelector('#closeClinicalRecord').click();
  });

  it('issues a grounded psychological certificate without medication prescription',async()=>{
    await vi.waitFor(()=>expect(document.querySelector('#openPsychDocuments')).toBeTruthy());document.querySelector('#openPsychDocuments').click();await vi.waitFor(()=>expect(document.querySelector('#psychDocDialog').open).toBe(true));document.querySelector('[data-new-psych-doc="certificate"]').click();const form=document.querySelector('#psychDocForm');form.elements.recipient.value='Empresa solicitante';form.elements.purpose.value='Justificar impedimento temporário';form.elements.professional_registration.value='CRP 00/000001';form.elements.requested_by.value='Mariana Costa';form.elements.basis.value='Processo de avaliação psicológica registrado';form.elements.conclusion.value='Condição psicológica que requer afastamento temporário';form.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach(input=>input.checked=true);form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(globalThis.__apiState.psychologicalDocuments).toHaveLength(1));expect(globalThis.__apiState.psychologicalDocuments[0].type).toBe('certificate');await vi.waitFor(()=>expect(document.querySelector('#psychDocPrintable').textContent).toContain('Atestado psicológico'));document.querySelector('[data-close-preview]').click();document.querySelector('#closePsychDocs').click();
  });

  it('edits the patient profile through the API',async()=>{
    document.querySelector('#editPatient').click();const form=document.querySelector('#patientEditForm');form.elements.phone.value='11000000000';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(globalThis.__apiState.patients[0].phone).toBe('11000000000'));
    await vi.waitFor(()=>expect(document.querySelector('#patientProfile').open).toBe(false));
  });

  it('archives without deleting clinical history',async()=>{
    await vi.waitFor(()=>expect(document.querySelector('#patientRows [data-patient-id="pat_1"]')).toBeTruthy());document.querySelector('#patientRows [data-patient-id="pat_1"]').click();await vi.waitFor(()=>expect(document.querySelector('#archivePatient')).toBeTruthy());document.querySelector('#archivePatient').click();
    await vi.waitFor(()=>expect(globalThis.__apiState.patients[0].status).toBe('archived'));
    expect(confirm).toHaveBeenCalled();
  });
});
