# Fundação SaaS do Psyché

## Entrega atual

- Cada sessão profissional deriva o `clinic_id` exclusivamente do usuário autenticado.
- O contexto da clínica reúne assinatura, plano, módulos, limites e consumo.
- Módulos são autorizados no backend; ocultar a navegação é apenas uma camada de experiência.
- A clínica pode desativar módulos incluídos no plano, mas não habilitar módulos não contratados.
- O módulo administrativo é obrigatório.
- Assinaturas suspensas ou canceladas não acessam módulos operacionais.
- Limites de usuários, unidades e pacientes são verificados antes da criação.
- Alterações de módulos são registradas na auditoria.

## Próxima migração: PostgreSQL

1. Adotar migrações numeradas e transacionais, sem criação de esquema durante o boot.
2. Converter valores booleanos SQLite para `boolean` e valores monetários para `bigint` em centavos.
3. Manter identificadores globais e `clinic_id NOT NULL` em toda entidade pertencente ao tenant.
4. Criar índices compostos começando por `clinic_id` nas consultas operacionais.
5. Aplicar Row-Level Security como defesa adicional, usando o tenant definido pela API em cada transação.
6. Separar credenciais de migração das credenciais usadas pela aplicação.
7. Executar importação com contagem, hashes de verificação e relatório de divergências.
8. Testar restauração, rollback e isolamento antes de aceitar dados clínicos reais.

### Comandos disponíveis

```bash
# Aplica migrações pendentes e valida o checksum das já aplicadas
npm run db:migrate

# Simula a transferência e desfaz a transação ao final
npm run db:transfer:dry

# Transfere os dados do SQLite configurado em PSYCHE_DB_PATH
npm run db:transfer
```

Os comandos exigem `PSYCHE_DATABASE_URL`. A credencial usada na transferência deve ser uma credencial exclusiva de migração com permissão para ignorar temporariamente RLS. Ela não deve ser reutilizada pela API.

Os scripts carregam automaticamente o arquivo `.env` localizado na raiz do projeto. Não é necessário executar `source .env`, evitando problemas com caracteres especiais presentes na senha da conexão.

As migrações ficam em `server/db/migrations`. Um arquivo aplicado não pode ser editado: o executor compara SHA-256 e interrompe o processo se detectar divergência.

### Estado de ativação

O esquema PostgreSQL, o executor e o importador já estão disponíveis. A migração operacional é incremental: cada repositório possui uma chave explícita no ambiente e as rotas ainda não migradas permanecem temporariamente no SQLite.

### Ponte de autenticação

Com `PSYCHE_AUTH_STORE=postgres`, identidade, política de sessão, criação/revogação da sessão, contexto do tenant e configuração modular usam PostgreSQL. A sessão é espelhada no SQLite durante a transição para que os módulos operacionais ainda não migrados continuem autenticados. O padrão permanece `sqlite` até a homologação ser aprovada.

### Ponte de pacientes

Com `PSYCHE_PATIENT_STORE=postgres`, listagem, criação, detalhe, atualização, arquivamento, perfil protegido e consentimentos usam PostgreSQL com RLS e contexto de tenant definido na transação. Campos de emergência e endereço permanecem criptografados no banco e são removidos da resposta antes da serialização. Durante a transição, as gravações são espelhadas no SQLite para preservar agenda, financeiro e prontuário ainda dependentes da base local; falhas de espelhamento disparam compensação no PostgreSQL.

### Ponte do prontuário longitudinal

Com `PSYCHE_CLINICAL_STORE=postgres`, anamnese, planejamento de caso, evolução, encaminhamento e encerramento são lidos e gravados no PostgreSQL. O conteúdo permanece criptografado, registros restritos respeitam a autoria profissional e a combinação clínica/paciente/tipo/versão é única. Um lock transacional serializa a próxima versão para evitar colisões em gravações simultâneas. O espelhamento SQLite permanece apenas enquanto sessões e documentos ainda estiverem em migração.

### Ponte das sessões de atendimento

Com `PSYCHE_SESSION_STORE=postgres`, início, consulta, autosave e finalização do atendimento usam PostgreSQL. Cronômetro, notas e histórico SUD/EMDR são persistidos de forma cifrada. A conclusão atualiza o agendamento na mesma transação e torna a sessão imutável. Registros legados que não autenticam com a chave atual são retornados sem ciphertext e marcados como conteúdo indisponível.

### Ponte de documentos psicológicos

Com `PSYCHE_DOCUMENT_STORE=postgres`, atestados e orientações usam PostgreSQL para criação, listagem, emissão e cancelamento. A numeração anual é serializada por clínica e tipo. A verificação pública usa `psyche_verify_document(text)`, função restrita que retorna apenas número, tipo, situação, emissão e identificação profissional, nunca o conteúdo clínico cifrado.

### Ponte do livro financeiro

Com `PSYCHE_FINANCE_STORE=postgres`, resumo mensal, receitas, despesas, contas a receber, filtros, edição e estorno lógico usam PostgreSQL. Valores monetários permanecem como inteiros em centavos e toda consulta começa pelo `clinic_id`. O SQLite continua recebendo um espelho temporário enquanto contas a pagar, recibos e notas fiscais são conectados ao mesmo repositório financeiro.

### Ponte de fornecedores e contas a pagar

Com `PSYCHE_PAYABLES_STORE=postgres`, fornecedores, parcelas, recorrência, filtros, vencimentos, edição, pagamento e cancelamento usam PostgreSQL. O pagamento bloqueia a conta, cria a despesa no livro financeiro e liquida a parcela na mesma transação. O cancelamento estorna logicamente o lançamento financeiro vinculado.

### Ponte de recibos

Com `PSYCHE_RECEIPT_STORE=postgres`, resumo, filtros, emissão, detalhe e cancelamento de recibos usam PostgreSQL. A emissão valida o pagamento recebido, impede duplicidade por lançamento e serializa a numeração anual. A verificação pública usa `psyche_verify_receipt(text)` e nunca retorna identidade do paciente nem descrição do serviço.

### Ponte de notas fiscais

Com `PSYCHE_INVOICE_STORE=postgres`, resumo, filtros, criação e transições fiscais usam PostgreSQL. A numeração interna anual é serializada, pagamentos não podem ter duas notas ativas e recibos vinculados precisam pertencer ao mesmo paciente e clínica. Os estados `draft`, `processing`, `authorized` e `cancelled` permanecem separados dos identificadores e erros do provedor municipal.

### Ponte da agenda

Com `PSYCHE_AGENDA_STORE=postgres`, regras semanais de unidades e profissionais, listagem, criação, reagendamento, cancelamento, confirmações e eventos usam PostgreSQL. Criação e reagendamento obtêm lock por profissional, exigem interseção entre horário da unidade e disponibilidade profissional e verificam sobreposição antes de gravar. Consultas de profissionais permanecem limitadas à própria agenda.

A role futura da API deve receber apenas `EXECUTE` em `psyche_login_identity(text)` para o lookup inicial e permissões operacionais limitadas. A credencial proprietária usada nas migrações não deve ser usada pelo servidor publicado.

## Onboarding e assinatura

O cadastro público não deve criar diretamente uma clínica ativa. O fluxo previsto é:

1. registrar conta e verificar e-mail;
2. criar tenant em estado `trialing`;
3. selecionar plano;
4. cadastrar unidade e responsável;
5. aceitar contratos e termos aplicáveis;
6. configurar pagamento;
7. ativar módulos do plano;
8. registrar toda mudança de assinatura via webhook idempotente.

## Próximos componentes

- provedor de identidade com MFA e recuperação de senha;
- gateway de assinatura e webhooks;
- armazenamento privado de documentos;
- fila para mensagens, PDFs e integrações;
- observabilidade, alertas e backups externos;
- painel interno da plataforma separado do painel das clínicas.
