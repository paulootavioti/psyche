export const commercialPlans = [
  {
    key: 'essential',
    name: 'Essencial',
    audience: 'Para psicóloga ou psicólogo autônomo',
    monthlyCents: 14700,
    yearlyCents: 158760,
    featured: false,
    features: ['1 profissional', '1 consultório', 'Agenda e portal do paciente', 'Cadastro e prontuário psicológico', 'Documentos e comunicação segura']
  },
  {
    key: 'professional',
    name: 'Profissional',
    audience: 'Para estruturas a partir de 2 consultórios',
    monthlyCents: 27700,
    yearlyCents: 299160,
    featured: true,
    features: ['Até 5 profissionais', 'A partir de 2 consultórios', 'Gestão financeira e indicadores', 'Teleatendimento e ferramentas EMDR', 'Permissões, relatórios e automações']
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    audience: 'Para clínicas com gestão integrada',
    monthlyCents: 34700,
    yearlyCents: 374760,
    featured: false,
    features: ['Até 50 profissionais', 'Até 10 unidades', 'Gestão administrativa completa', 'Estoque, contas a pagar e marketing', 'Recibos e integração de NFS-e']
  }
];

export const money = cents => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(cents / 100);
export const annualSavings = plan => plan.monthlyCents * 12 - plan.yearlyCents;
