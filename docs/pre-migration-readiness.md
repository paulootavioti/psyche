# Psyché — fechamento antes da migração SaaS

Este documento delimita o que funciona na arquitetura local atual e o que deve permanecer bloqueado até a adoção da infraestrutura de produção.

## Implementado e verificável

- Autenticação, expiração configurável de sessão, revogação no logout e limitação de tentativas.
- Isolamento das consultas por clínica e permissões por função.
- Pacientes, agenda, equipe, unidades, serviços, financeiro, contas a pagar, recibos, notas fiscais, estoque, comunicação, marketing, feedback e relatórios.
- Atendimento com cronômetro, estímulo visual e sonoro bilateral, SUD, respiração guiada, utilitários e mídia local.
- Prontuário longitudinal com anamnese, planejamento de caso, evoluções, encaminhamentos e encerramento.
- Registros clínicos append-only, versionados, cifrados e separados entre prontuário e acesso restrito.
- Atestado psicológico e orientações psicológicas não medicamentosas, com rascunho, emissão, numeração, verificação, impressão e arquivo cifrado.
- Rascunho clínico cifrado salvo automaticamente no backend.
- Finalização clínica transacional, conclusão do agendamento e bloqueio de edição posterior.
- Criptografia de campos clínicos, mensagens e dados pessoais selecionados.
- Trilha de auditoria das operações sensíveis.
- Validações, estados vazios/erro, exportações CSV e layout responsivo.
- Inicialização de produção bloqueada quando chave, senha administrativa ou origem permitida não forem configuradas.
- Migrações numeradas de PostgreSQL e adaptação da API para Netlify Functions, com pool compartilhado entre os módulos e sem dependência do SQLite legado. Ver [deploy no Netlify](netlify-deploy.md).
- Política configurável de cobrança prévia ou posterior, tolerância, faltas e revisão administrativa.

## Regras clínicas e financeiras adotadas

- O prontuário compartilhável contém informações sintéticas, necessárias e acessíveis à pessoa atendida.
- Materiais privativos, protocolos e análises restritas devem usar a visibilidade `restricted`.
- Novas versões são acrescentadas sem sobrescrever o histórico anterior.
- Pendências financeiras geram aviso ou revisão administrativa, nunca bloqueio clínico automático.
- Cobrança antecipada, prazo de cancelamento e cobrança por ausência somente podem ser aplicados quando previamente informados e acordados.
- Vulnerabilidade, urgência e emergência permitem decisão profissional justificada; a qualidade do serviço não varia com o valor acordado.

Referências: [Resolução CFP nº 001/2009](https://transparencia.cfp.org.br/wp-content/uploads/sites/15/2016/12/resolucao2009-01.pdf) e [Código de Ética Profissional](https://transparencia.cfp.org.br/crp08/legislacao/codigo-de-etica/).

## Rotas clínicas atuais

- `POST /api/clinical-sessions` — cria rascunho de sessão.
- `PATCH /api/clinical-sessions/:id` — autosave e finalização.
- `GET /api/clinical-sessions/:id` — leitura autorizada da sessão.
- `GET /api/patients/:id/clinical-records?type=anamnesis` — histórico clínico filtrado.
- `POST /api/patients/:id/clinical-records` — nova versão de anamnese, plano, evolução, encaminhamento ou encerramento.
- `GET /api/billing/policy` — política financeira aplicável aos fluxos clínicos.
- `GET /api/patients/:id/psychological-documents` — documentos psicológicos do paciente.
- `POST /api/patients/:id/psychological-documents` — cria ou emite atestado/orientações.
- `PATCH /api/psychological-documents/:id` — emite rascunho ou cancela documento.

O módulo não oferece receituário medicamentoso. Para psicólogas(os), o Psyché oferece orientações e recomendações pertinentes ao acompanhamento, além dos documentos previstos pela Resolução CFP nº 06/2019.

## Deliberadamente pendente de infraestrutura externa

- Cadastro autônomo de clínicas, planos, trial e cobrança recorrente.
- MFA, verificação de e-mail e recuperação de senha por provedor de identidade/e-mail.
- Pagamento online no portal do paciente.
- Emissão municipal real de NFS-e.
- Armazenamento privado, antivírus e URLs assinadas para documentos e vídeos.
- Entrega externa de e-mail, WhatsApp, SMS e notificações push.
- Canal real de suporte, observabilidade, alertas e gestão de incidentes.
- Backups externos e testes automatizados de restauração.

Nenhum item pendente deve ser apresentado ao usuário como ativo. A interface informa a necessidade de configuração quando o recurso depende desses serviços.
