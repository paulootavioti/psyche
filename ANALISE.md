# Análise técnica do Psyché

Análise de `main` no commit **`fc4daa3`** (merge do PR #2), de 19/08/2026. Todos os caminhos, números de linha e comportamentos citados foram verificados executando o código desta revisão.

> Este documento é um retrato de um commit. Ao lê-lo, confira com `git log -1 --format=%H` se `main` ainda está em `fc4daa3`; se avançou, trate as seções 5, 6 e 9 como as mais sujeitas a envelhecer.

---

## 1. Stack e arquitetura

### Linguagens e dependências

Projeto 100% JavaScript ESM (`"type": "module"` em `package.json`), sem TypeScript e sem framework de aplicação.

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 22 (fixado em `netlify.toml`) |
| Backend | `node:http` puro — sem Express/Fastify | — |
| Banco de produção | PostgreSQL via `pg` | ^8.13.1 |
| Banco legado/dev | SQLite via `node:sqlite` | builtin |
| Frontend | JavaScript vanilla + DOM API | — |
| Build | Vite | 4.5.14 |
| Testes | `node:test` (backend) + Vitest 0.34.6 + happy-dom 15.11.7 (frontend) | — |
| Serverless | `serverless-http` | ^3.2.0 |

As únicas dependências de produção são `pg` e `serverless-http`. Todo o resto — roteamento, parsing de corpo, criptografia, hash de senha, validação — é implementado à mão em `server/`.

### Estrutura de pastas

```
index.html, style.css        Casca da SPA (entry único)
src/                         Frontend: 29 módulos .js + styles.css
  app.js                     Bootstrap, navegação e templates das views
  api.js                     Cliente HTTP único (classe ApiClient)
  backend-integration.js     Ponte entre a UI e a API
  <modulo>.js                agenda, patients, finance, payables, receipts,
                             invoices, inventory, operations, chat, marketing,
                             reports, settings, team, dashboard, schedules,
                             clinical-records, psychological-documents,
                             patient-portal, enhanced, signup, plans, sales,
                             legal, bootstrap
  test/                      15 arquivos Vitest
server/                      Backend
  app.js                     createApp(): 78 rotas num único handler (250 linhas)
  database.js                Esquema SQLite legado + seed
  security.js                AES-256-GCM, scrypt, tokens, validadores
  modules.js                 Catálogo de módulos, planos e gate por rota
  <dominio>-store.js         14 stores PostgreSQL
  db/postgres.js             Fábrica de pool + withTenant()
  db/migrate.js              Runner de migrações com checksum
  db/migrations/*.sql        14 migrações numeradas
  db/transfer-sqlite.js      Importação SQLite → PostgreSQL
  db/check-runtime-role.js   Confere que o runtime não é superusuário
  email-service.js           E-mail transacional (Resend)
  start.js                   Entrada do servidor local
  test/                      14 arquivos node:test
netlify/functions/api.js     Adaptador serverless
netlify.toml                 Build, redirects, headers
docs/                        4 documentos de projeto
```

### Comunicação front ↔ back

O frontend conversa com a API por um único cliente, `src/api.js:1`:

```js
const baseUrl = import.meta.env.VITE_API_URL || '/api';
```

O token vai em `Authorization: Bearer` e é guardado em `sessionStorage` sob a chave `psyche:apiToken` (`src/api.js:4`). Não há cookies nem CSRF token — a escolha de `sessionStorage` + header evita o problema de CSRF, mas expõe o token a XSS.

Três topologias, todas servindo o mesmo `handler`:

1. **Desenvolvimento** — Vite na porta 5180 faz proxy de `/api` para `127.0.0.1:8787` (`vite.config.js:8-13`); a API sobe por `server/start.js:6`.
2. **Produção Netlify** — `netlify.toml:12-16` reescreve `/api/*` para `/.netlify/functions/api/:splat` **antes** do fallback da SPA; `netlify/functions/api.js` embrulha o mesmo `handler` com `serverless-http` e normaliza o path de volta para `/api/...`.
3. **Testes** — `server/test/api.test.js:20` instancia `createApp()` com SQLite em memória e sobe um servidor HTTP real.

O ponto forte do desenho é `createApp()` retornar `{ server, handler, db, ...stores }` (`server/app.js:240`): o mesmo código de rota atende os três ambientes, sem duplicação.

### Seleção de persistência

Cada domínio escolhe seu backend por variável de ambiente, em `server/app.js:52-65`:

```js
const sharedPostgresPool = !database && needsPostgres ? postgresPool() : null;
const identityStore = authStore || (storeMode('PSYCHE_AUTH_STORE') === 'postgres' ? postgresAuthStore(sharedPostgresPool) : null);
```

Um único pool é criado em `server/app.js:51` e injetado nos 14 stores, de modo que `PSYCHE_DB_POOL_SIZE` é o teto de conexões por instância, não por módulo.

São 14 chaves independentes (`PSYCHE_AUTH_STORE` … `PSYCHE_ANALYTICS_STORE`). Store nulo = caminho SQLite embutido no próprio `app.js`. Com os 14 em `postgres`, `postgresPrimary` fica verdadeiro e o SQLite nunca é aberto (`server/app.js:66-67`).

---

## 2. Modelo de dados

Fonte de verdade em produção: as 14 migrações em `server/db/migrations/`, que somam **46 tabelas** — 36 em `001_platform.sql`, 3 em `009_operational_assets.sql`, 3 em `012_commercial_subscriptions.sql`, 1 em `013` e 3 em `014`. O espelho SQLite em `server/database.js` cobre só as 39 originais e é mantido à mão (ver §7).

### Plataforma e tenancy

| Tabela | Papel |
|---|---|
| `clinics` | O tenant. Raiz de tudo. |
| `plans` | Catálogo global de planos. Desde a `012` carrega preço mensal, anual, moeda e descrição. |
| `clinic_subscriptions` | 1:1 com `clinics` → `plans`; status `trialing/active/past_due/suspended/cancelled`. Desde a `012` também ciclo de faturamento e identificadores do provedor de pagamento. |
| `subscription_provider_plans` | Plano+ciclo → id externo do provedor. Catálogo global, hoje inacessível (§3, Problema G). |
| `subscription_invoices` | → `clinics`. Faturas da assinatura, `UNIQUE(provider,provider_invoice_id)`. |
| `subscription_webhook_events` | Eventos do provedor, `UNIQUE(provider,provider_event_id)` para idempotência. Sem `clinic_id`. |
| `subscription_change_requests` | → `clinics`, `users`, `plans`. Pedidos de troca, cancelamento ou reativação. |
| `legal_documents` | Termos e política por versão (PK `key,version`). Catálogo global. |
| `signup_requests` | Cadastro público pendente de verificação. Pré-tenant, sem `clinic_id`. |
| `legal_acceptances` | → `clinics`, `users`, `legal_documents`. Aceite versionado com IP e user agent. |
| `clinic_module_overrides` | Liga/desliga módulos por clínica (PK composta `clinic_id,module_key`). |
| `units` | Unidades físicas da clínica. |
| `clinic_settings` | Configurações chave/valor JSON (PK `clinic_id,key`). |
| `audit_log` | Trilha de auditoria. |
| `schema_migrations` | Criada por `server/db/migrate.js:13`. |

### Identidade

| Tabela | Relacionamentos |
|---|---|
| `users` | → `clinics`, → `units`. `email` **UNIQUE global**. Papel em CHECK: `admin/professional/reception/finance`. |
| `sessions` | → `users`. `token_hash` UNIQUE. Não tem `clinic_id` — o tenant vem por `EXISTS` na policy. |
| `patient_users` | PK = `patient_id`. Credencial do portal. `email` **UNIQUE global**. |
| `patient_sessions` | → `patients`. Mesma estrutura de `sessions`. |

### Clínico

| Tabela | Relacionamentos |
|---|---|
| `patients` | → `clinics`, → `users` (profissional responsável). `cpf_encrypted`. |
| `patient_profiles` | 1:1 com `patients`. Emergência e endereço cifrados. |
| `patient_consents` | N:1 `patients`. Consentimentos com validade. |
| `patient_documents` | N:1 `patients`. Metadados; o binário depende de storage externo inexistente. |
| `clinical_sessions` | → `patients`, `users`, `appointments`. `notes_encrypted`, `sud_history_encrypted`. |
| `clinical_records` | → `patients`, `users`, `clinical_sessions`. Tipos `anamnesis/case_plan/evolution/referral/closure`; `visibility` `record/restricted`; versionado por índice único (`005`). |
| `psychological_documents` | → `patients`, `users`. Tipos `certificate/guidance`; `verification_code` UNIQUE. |

### Agenda

`appointments` (→ `patients`, `users`, `units`) é o centro, com três satélites: `appointment_confirmations` (1:1, PK = `appointment_id`), `appointment_events` (histórico N:1) e as regras de disponibilidade — `unit_schedule_rules`, `professional_schedule_rules` (ambas com UNIQUE composta sobre dia/hora/sala) e `professional_availability`.

### Financeiro

`financial_entries` (→ `patients`, `appointments`) é o razão. Dele derivam `receipts` (UNIQUE `clinic_id,number`) e `fiscal_invoices` (UNIQUE `clinic_id,internal_number`), que também se referenciam entre si. `accounts_payable` → `suppliers`, `units` e opcionalmente gera um `financial_entries` na baixa. Todo valor é `bigint` em centavos.

### Operações e relacionamento

`inventory_items` → `inventory_movements` (com `balance_after` materializado). `clinic_rooms` → `room_equipment` → `equipment_maintenance` (migração 009). `conversations` (1:1 com paciente) → `messages` (`body_encrypted`). `campaigns`, `feedback` (`comment_encrypted`), `services`.

### Campos cifrados

Nove colunas usam AES-256-GCM com prefixo `v1.` (`server/security.js:26-34`): `cpf_encrypted`, `emergency_name_encrypted`, `emergency_phone_encrypted`, `address_encrypted`, `body_encrypted`, `notes_encrypted`, `sud_history_encrypted`, `content_encrypted`, `comment_encrypted`.

---

## 3. Multi-tenancy

**Sim, existe isolamento por tenant, e é a parte mais bem construída do sistema.** São três camadas independentes.

### Camada 1 — `clinic_id` nunca vem do cliente

Em todas as 78 rotas, o tenant é derivado do usuário autenticado, nunca do corpo ou da query. O padrão é invariável (`server/app.js:78`):

```js
const requireAccess = async (req, res, permission) => {
  const user = await authenticate(req);
  ...
};
```

e em seguida `user.clinic_id` é o primeiro argumento de toda chamada de store. Não encontrei nenhuma rota que aceite `clinic_id` como entrada. Isso elimina de saída a classe mais comum de vazamento entre clientes (IDOR de tenant).

### Camada 2 — Row-Level Security no PostgreSQL

`server/db/migrations/002_tenant_rls.sql` habilita `ENABLE` + **`FORCE ROW LEVEL SECURITY`** em 35 tabelas; `009`, `012`, `013` e `014` acrescentam mais 7 — **42 de 46**. As quatro sem RLS são `plans`, `legal_documents` (catálogos globais), `subscription_webhook_events` (eventos chegam antes de se saber o tenant) e `signup_requests` (pré-tenant por definição). Todas defensáveis; a última merece a atenção descrita adiante.

Trinta tabelas usam a policy direta:

```sql
CREATE POLICY tenant_isolation ON %I USING (clinic_id = current_tenant_id()) WITH CHECK (clinic_id = current_tenant_id())
```

As cinco sem `clinic_id` próprio usam policy por `EXISTS`: `clinics` (por `id`), `sessions` e `patient_users`/`patient_sessions` (pelo dono) e `messages` (pela `conversation`). O `FORCE` é o detalhe que importa: aplica a policy inclusive ao dono da tabela.

O tenant é injetado por transação em `server/db/postgres.js:18-25`:

```js
if(!/^cln_[a-zA-Z0-9_-]+$/.test(String(clinicId)))throw new Error('Identificador de tenant inválido');
await client.query("SELECT set_config('app.clinic_id',$1,true)",[clinicId]);
```

O terceiro parâmetro `true` torna o `set_config` local à transação — correto, e essencial com pool compartilhado: a conexão devolvida ao pool não carrega o tenant anterior. O regex bloqueia injeção pelo identificador.

### Camada 3 — filtro explícito por `clinic_id`

Mesmo sob RLS, todas as queries dos stores filtram `clinic_id` na mão (`WHERE clinic_id=$1`), e os testes verificam isso (`server/test/patient-store.test.js:17`). Defesa em profundidade correta.

### Superfície que atravessa tenants — auditada uma a uma

O único caminho que ignora RLS são cinco funções `SECURITY DEFINER`, todas legítimas por natureza (login e verificação pública ocorrem antes de existir um tenant):

| Função | Migração | `row_security=off` | `GRANT` a `psyche_app` |
|---|---|---|---|
| `psyche_login_identity` | 004 | sim | 011 |
| `psyche_verify_document` | 006 | sim | 011 |
| `psyche_verify_receipt` | 007 | sim | 011 |
| `psyche_patient_login_identity` | 008 | **não** | 008 e 011 |
| `psyche_session_identity` | 010 | sim | 010 e 011 |
| `psyche_patient_session_identity` | 010 | sim | 010 e 011 |

O escopo de dados de cada uma é adequado: as de verificação devolvem apenas campos não clínicos, e as de login devolvem uma linha por e-mail/token. Nenhuma vaza conteúdo clínico.

A coluna de `GRANT` está resolvida: `011_runtime_role_grants.sql` concede `EXECUTE` nas seis funções, mais `USAGE` no schema e DML em todas as tabelas, com `ALTER DEFAULT PRIVILEGES` para as futuras. Sobra uma inconsistência na coluna do meio.

### Problema A — `psyche_patient_login_identity` sem `SET row_security=off`

`server/db/migrations/008_patient_identity.sql:5` é a única das seis sem a cláusula. Como as tabelas têm `FORCE ROW LEVEL SECURITY`, a policy vale também para o dono da função; e no login ainda não há tenant, então `current_tenant_id()` é `NULL` e `clinic_id = NULL` é falso. Resultado esperado: **zero linhas, sempre** — o login do portal do paciente (`server/engagement-store.js:4`, consumido por `server/app.js:104`) responde "credenciais inválidas" para todo mundo em produção. Não é vazamento; é indisponibilidade silenciosa de um módulo inteiro. (Se o papel definidor tiver `BYPASSRLS`, funciona — mas aí por acidente, não por desenho.)

### Problema B — o papel `psyche_app` nunca é criado

Nenhuma migração contém `CREATE ROLE`, e `docs/runtime-database-role.md` também não: o passo 2 do documento manda `ALTER ROLE psyche_app WITH LOGIN PASSWORD ...`, que falha se o papel não existir. As migrações 008, 010 e 011 fazem `GRANT ... TO psyche_app`; num banco novo, sem o papel criado à mão antes, `npm run db:migrate` aborta na 008. Cada migração é transacional, mas o conjunto não — o esquema fica pela metade.

O `server/db/check-runtime-role.js` verifica depois o que já deveria ter sido garantido antes: confirma que a conexão usa `psyche_app` sem `superuser` nem `bypassrls`. É uma boa rede de segurança — só não substitui a criação do papel.

### Problema C — `/api/portal/*` fora do gate de módulo e assinatura

O gate de módulo/assinatura está em `server/app.js:113` e consulta `moduleForPath()` (`server/modules.js:20-28`). A lista de rotas ali não inclui `/api/portal`. As cinco rotas do portal (`server/app.js:104-108`) ficam, portanto, fora da checagem de módulo `communication` **e** da checagem de assinatura ativa. Uma clínica com assinatura `suspended` ou `cancelled` continua servindo o portal do paciente. Não é vazamento entre tenants — cada rota valida o paciente autenticado —, mas é uma brecha de autorização comercial.

### Problema D — o caminho SQLite não tem isolamento estrutural

No modo legado (qualquer `PSYCHE_*_STORE` diferente de `postgres`) não existe RLS: o isolamento depende inteiramente de cada `WHERE clinic_id=?` escrito à mão, dentro de um arquivo de 53 rotas. Auditei as queries desse caminho; duas leem tabela de tenant só por id, em `server/app.js:89` (`sendAppointmentConfirmation`):

```js
h.one(db,'SELECT name FROM users WHERE id=?',appointment.professional_id)
h.one(db,'SELECT name FROM units WHERE id=?',appointment.unit_id)
```

Na prática não vazam, porque os ids vêm de um `appointment` já validado por `clinic_id` — mas são consultas sem rede de proteção, exatamente o tipo que vira vazamento na primeira refatoração. Já `DELETE FROM sessions WHERE expires_at<=?` (mesmo arquivo, rota de login) apaga sessões expiradas **de todos os tenants** a cada login; é limpeza inofensiva, mas cruza a fronteira.

### Problema E — e-mail é único globalmente

`users.email` e `patient_users.email` são `UNIQUE` sem escopo de clínica (`001_platform.sql:21` e `:25`). Consequência de produto: a mesma psicóloga não pode atuar em duas clínicas do sistema, e um paciente não pode ter conta em duas clínicas com o mesmo e-mail. É decisão estrutural, não bug, mas limita o modelo multi-tenant e é caro de reverter depois que houver dados.

### Problema F — auditoria sem tenant derruba a requisição no modo PostgreSQL

Em `server/app.js:68` a auditoria decide assim:

```js
if(administrativeStore&&event.clinicId)await administrativeStore.appendAudit(event);
else db.prepare('INSERT INTO audit_log VALUES (...)').run(...)
```

Quando há store PostgreSQL mas o evento **não tem** `clinic_id`, a condição é falsa e a execução cai no ramo SQLite — só que nesse modo `db` é `null` (`server/app.js:67`). O caso concreto é `login_failed` com e-mail inexistente: não existe usuário, logo não existe tenant.

Reproduzi com os 14 stores em PostgreSQL:

```
POST /api/auth/login  {"email":"ninguem@exemplo.com", ...}
HTTP 500
{"error":"Erro interno do servidor","request_id":"req_bdc5d4d2-..."}
```

e no log do servidor:

```
[psyche-api] request req_bdfc887a-... TypeError: Cannot read properties of null (reading 'prepare')
    at audit (server/app.js:68:315)
    at handler (server/app.js:101:854)
```

O tratamento de erro melhorou: a resposta é genérica, com `request_id` correlacionável, e o `TypeError` fica só no log — não há mais vazamento de mensagem interna. **Mas o defeito funcional permanece**: quem erra o e-mail no login recebe um erro de servidor em vez de `401 Credenciais inválidas`, e a tentativa não entra na trilha de auditoria. Do ponto de vista de quem sonda o sistema, `500` para e-mail inexistente e `401` para e-mail existente com senha errada é um oráculo de enumeração de usuários — a diferença de resposta entrega quais e-mails estão cadastrados.

### Problema G — `subscription_provider_plans` nega todas as linhas a todo mundo

`012_commercial_subscriptions.sql` habilita RLS na tabela e **não cria policy nenhuma**:

```sql
ALTER TABLE subscription_provider_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_provider_plans FORCE ROW LEVEL SECURITY;
-- a única CREATE POLICY da migração é para subscription_invoices
```

No PostgreSQL, RLS habilitada sem policy é negação total: nenhuma linha é visível, nem para o dono da tabela (por causa do `FORCE`). O `GRANT SELECT ON plans,subscription_provider_plans TO psyche_app`, três linhas abaixo, é inócuo.

A tabela nem deveria ter RLS: não tem `clinic_id`, é catálogo global como `plans` — que corretamente ficou sem RLS. O efeito hoje é latente, porque nenhuma rota a consulta ainda; vira falha concreta no dia em que o checkout precisar traduzir plano em `provider_plan_id`.

### Problema H — a checagem de e-mail duplicado no cadastro nunca dispara

`createSignup` e `verifySignup` (`server/auth-store.js:19` e `:21`) protegem contra conta duplicada assim:

```js
if((await client.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1',[request.email])).rows[0])
  throw Object.assign(new Error('Já existe uma conta com este e-mail'),{status:409});
```

Só que `users` tem RLS por `clinic_id=current_tenant_id()` e essa consulta roda **antes** de qualquer `set_config` — no cadastro público ainda não existe tenant. Com `current_tenant_id()` nulo, a policy é falsa e o `SELECT` devolve zero linhas **sempre**. A guarda é decorativa.

A consequência não é conta duplicada — o `UNIQUE` global de `users.email` segura —, mas o erro chega cru: a violação vem do PostgreSQL como `23505`, o `catch` de `server/app.js:249` classifica como 409 e devolve `error.message` sem tratamento, expondo o nome da constraint. E acontece só na verificação, depois de o e-mail já ter sido enviado, em vez de no cadastro.

### Nova superfície pré-tenant: `signup_requests`

Das 46 tabelas, quatro estão sem RLS: `plans` e `legal_documents` (catálogos globais), `subscription_webhook_events` (eventos chegam antes de se saber o tenant) e `signup_requests`. As quatro são defensáveis por natureza, mas `signup_requests` merece atenção: guarda `password_hash`, `created_ip`, telefone e nome da clínica de quem ainda não é cliente, e é acessível diretamente por `psyche_app` sem nenhum filtro.

Note a inconsistência de estratégia: para o outro acesso pré-tenant — login —, o projeto usa funções `SECURITY DEFINER` com escopo mínimo de colunas e `REVOKE` de `PUBLIC`. Aqui optou-se por `GRANT SELECT,INSERT,UPDATE` na tabela inteira. O token está corretamente guardado só como hash e há índice único parcial impedindo cadastros pendentes duplicados por e-mail, então o desenho é sólido — mas qualquer bug numa consulta futura a essa tabela enumera todos os cadastros em andamento, sem que RLS ou função restrita sirvam de rede.

Um ponto bem resolvido, em contrapartida: `verifySignup` define `set_config('app.clinic_id', <novo id>, true)` antes de inserir a clínica, para que o `WITH CHECK` da policy aceite a linha. Criar tenant sob RLS sem recorrer a `BYPASSRLS` é acerto de projeto.

---

## 4. Autenticação e autorização

### Login e sessão

Dois domínios de identidade separados e independentes: equipe (`/api/auth/login`, `server/app.js:101`) e paciente (`/api/portal/auth/login`, `:95`).

- **Senha**: `scrypt` com salt aleatório de 16 bytes por senha, armazenada como `salt:hash` e comparada com `timingSafeEqual` (`server/security.js:11-22`). Mínimo de 6 caracteres — baixo demais para o contexto.
- **Token**: `randomBytes(32).toString('base64url')` (`server/security.js:25`). No banco grava-se apenas o SHA-256 (`token_hash`); o token puro nunca é persistido. Correto.
- **Expiração**: lida de `clinic_settings.security.session_timeout_minutes`, com padrão 480 min e clamp entre 15 e 720 (`server/app.js:101`).
- **Logout**: apaga a sessão pelo hash do token — revogação real, não apenas descarte no cliente.
- **Rate limit**: 5 tentativas por `ip:email` em janela de 15 minutos, com `Retry-After` (`server/app.js:69` e `:101`). Guardado num `Map` em memória.

### Papéis e permissões

RBAC estático em `server/app.js:21-27`, quatro papéis com permissões no formato `recurso:ação`:

| Papel | Permissões |
|---|---|
| `admin` | `*` |
| `professional` | patients, appointments, sessions, messages (read+write) |
| `reception` | patients, appointments, messages, inventory (read+write) |
| `finance` | patients:read, finance (read+write), inventory:read |

A verificação é `roles[user.role]?.includes('*') || roles[user.role]?.includes(permission)` (`server/app.js:28`). Além do papel, há restrição por dono: profissionais só enxergam os próprios pacientes e as próprias agendas (`actorRole`/`actorId` propagados aos stores).

### Camadas adicionais

Sobre o RBAC incidem ainda o gate de módulo (403 `MODULE_DISABLED`) e o de assinatura (402 `SUBSCRIPTION_INACTIVE`), em `server/app.js:113` — com a exceção do `/api/portal/*` descrita em §3.

### O que não existe

Sem MFA, sem verificação de e-mail, sem recuperação de senha, sem política de expiração ou histórico de senha, sem bloqueio progressivo de conta. `docs/pre-migration-readiness.md` lista tudo isso como pendente de provedor externo.

### Headers e CORS

Origens permitidas por lista explícita em `PSYCHE_APP_ORIGINS` (`server/app.js:93`), com `Vary: Origin`. A resposta traz `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` e CSP `default-src 'none'; frame-ancestors 'none'` — essa CSP vale para as respostas da API, e o `netlify.toml:23-29` cuida dos headers do site estático. Corpo limitado a 1 MB (`server/app.js:32`).

---

## 5. Cobrança

**Existe, e é recente.** As migrações `012_commercial_subscriptions.sql`, `013_subscription_change_requests.sql` e `014_public_onboarding.sql` trouxeram preço, ciclo de faturamento, onboarding autônomo e aceite legal versionado. O que ainda não existe é a conexão com um provedor de pagamento.

### O que já funciona

**Catálogo comercial.** `plans` ganhou `monthly_price_cents`, `yearly_price_cents`, `currency` e `description`. Os preços estão no banco, não no código: Essencial R$ 147/mês, Profissional R$ 277/mês, Enterprise R$ 347/mês, com anuidades com desconto. O plano `clinic` foi desativado (`active=false`). Exposto publicamente por `GET /api/public/plans`.

**Cadastro autônomo com verificação de e-mail.** `POST /api/public/signup` grava um `signup_requests` com senha já hasheada, token de verificação armazenado só como hash (`verification_token_hash text NOT NULL UNIQUE`), versões aceitas dos documentos legais, IP de origem e expiração. `POST /api/public/signup/verify` converte a solicitação em tenant real — clínica, assinatura em `trialing` de 14 dias, unidade principal, usuário admin e dois `legal_acceptances` — tudo numa única transação, com `ROLLBACK` em qualquer falha.

O detalhe bem resolvido: `verifySignup` define `set_config('app.clinic_id', <novo id>, true)` **antes** dos INSERTs, para que o `WITH CHECK` da policy de `clinics` aceite a linha nova. Criar um tenant sob RLS sem abrir exceção é o tipo de coisa que costuma ser resolvida com `BYPASSRLS`; aqui não foi.

**E-mail transacional.** `server/email-service.js` integra o Resend com `idempotency-key` por solicitação, escapa todo dado interpolado no HTML e nunca inclui a senha. Sem credencial configurada, `configured` é falso e a rota recusa o cadastro em produção — falha fechada, não aberta.

**Mudança de plano auditável.** `subscription_change_requests` registra pedido, autor (`requested_by → users`), plano de origem e destino, motivo e status, com RLS por tenant. `POST /api/platform/subscription/requests` exige papel `admin`.

**Enforcement.** Continua real: limites de usuários, unidades e pacientes antes da criação (`withinTenantLimit`, `server/app.js:79`), gate de módulo por rota e bloqueio 402 para assinatura fora de `active`/`trialing`.

### O que falta

**Nenhum provedor de pagamento está conectado.** As tabelas estão prontas — `subscription_provider_plans` mapeia plano → id externo, `subscription_invoices` guarda o ciclo `pending/paid/failed/refunded/cancelled`, `subscription_webhook_events` tem `UNIQUE(provider, provider_event_id)` para idempotência —, mas **nenhuma rota da API escreve ou lê nelas**. Não há endpoint de webhook nem de checkout entre as 78 rotas. `provider`, `provider_customer_id` e `provider_subscription_id` em `clinic_subscriptions` nunca são preenchidos.

Ou seja: hoje uma clínica consegue **se cadastrar sozinha e usar 14 dias de trial**, mas ninguém consegue **pagar**. Quando o trial expira, o status não avança sozinho — não há job de expiração nem cobrança recorrente. A modelagem antecipou corretamente a integração; falta o motor.

**`subscription_provider_plans` está inacessível.** Ver §3, Problema G: a tabela tem RLS habilitada e forçada sem nenhuma policy, o que nega todas as linhas a todos. O `GRANT SELECT` da mesma migração é inócuo. Quando o checkout for implementado, a consulta ao `provider_plan_id` virá vazia.

### O que não é cobrança

O módulo financeiro do produto (`financial_entries`, `receipts`, `fiscal_invoices`, `accounts_payable`) é o financeiro **da clínica com seus pacientes**, sem relação com a monetização do SaaS. A emissão de NFS-e segue como registro interno: `fiscal_invoices` tem `provider`, `external_id` e `verification_url`, mas nenhum código chama prefeitura alguma.

---

## 6. Testes

148 testes, todos passando nesta revisão: 70 no backend (`npm run test:server`) e 78 no frontend (`npm test`). O atalho `npm run test:production` encadeia os dois mais o `build`.

### Backend — 14 arquivos, 70 testes

| Arquivo | Testes | Cobre |
|---|---|---|
| `server/test/api.test.js` | 30 | Integração HTTP de ponta a ponta sobre SQLite em memória |
| `server/test/postgres.test.js` | 9 | Imutabilidade das migrações, RLS textual, assinatura comercial, onboarding, `withTenant`, pool |
| `server/test/patient-store.test.js` | 5 | Escopo de tenant e de profissional |
| `server/test/serverless.test.js` | 3 | Modo PostgreSQL puro sem abrir SQLite, liveness e readiness |
| `server/test/email-service.test.js` | 3 | E-mail desabilitado sem credencial, idempotência, erro do provedor |
| `server/test/auth-store.test.js` | 3 | Identidade, readiness e encerramento do pool |
| `server/test/finance-store.test.js` | 3 | Resumo e lançamentos |
| demais stores (7 arquivos) | 2 cada | Forma das queries por domínio |

`api.test.js` é o mais valioso: exercita login, RBAC, isolamento entre clínicas (`:88`), conflito de agenda, centavos inteiros, cifragem em repouso (verifica o prefixo `v1.` direto na coluna), imutabilidade de sessão finalizada e versionamento de prontuário.

### Frontend — 15 arquivos, 78 testes

Vitest com happy-dom e uma API falsa em `src/test/setup.js`. Cobrem renderização, filtros, formulários e fluxos de cada módulo da UI, agora incluindo `plans.test.js`.

Dois testes de `src/test/team.test.js` ("configures weekly availability…" e "edits and suspends a team member") falharam numa execução relatada em máquina local, um deles estourando o limite de 5 s por 46 ms. Aqui os 78 passam. O padrão — um `expected null to be truthy` e um timeout na fronteira — aponta para **instabilidade de tempo no happy-dom**, não defeito de lógica. Testes que dependem de `waitFor` sem folga são fonte recorrente de ruído em CI; vale elevar o `testTimeout` desse arquivo em vez de tratá-los como regressão.

### O que os testes não cobrem

Esta é a lacuna decisiva: **nenhum teste toca um PostgreSQL real.** Todos os testes de store injetam um pool falso (`fakePool` em `server/test/patient-store.test.js:5`) que só grava as strings SQL recebidas. Isso valida que a query *menciona* `clinic_id=$1`; não valida que a query é sintaticamente válida, que a coluna existe, que a policy de RLS bloqueia o tenant errado, ou que as funções `SECURITY DEFINER` funcionam. Os problemas de migração descritos em §3 (A e B) passariam ilesos por toda a suíte — e passam.

A lacuna não é só de banco. O problema F de §3 é JavaScript puro, reproduzível em memória e sem dependência externa, e mesmo assim escapa: os 30 testes de `api.test.js` rodam apenas no modo SQLite (`createApp({database: createDatabase(':memory:')})`), então **nenhum teste percorre as rotas no modo PostgreSQL puro** — a configuração que roda em produção.

Também não há: teste do adaptador Netlify (`netlify/functions/api.js` não é exercitado por nada), teste do `db/transfer-sqlite.js`, teste de carga ou de concorrência, e nenhum teste E2E de navegador.

Os testes novos das migrações comerciais (`postgres.test.js:38-63`) ilustram bem o limite do método: eles fazem `assert.match` sobre o **texto** do arquivo `.sql`, verificando que a string `CREATE TABLE subscription_invoices` existe. Isso protege contra remoção acidental, mas não executa uma linha de SQL — foi exatamente assim que a RLS sem policy de `subscription_provider_plans` (§3, Problema G) passou verde.

---

## 7. Dívida técnica — os problemas mais graves por risco real

Ordenados por perda de dados, depois segurança, depois indisponibilidade certa. A lista cresceu de 10 para 13: as migrações comerciais `012`–`014` fecharam um problema antigo (os `GRANT` para `psyche_app`) e abriram três novos.

**1. `PSYCHE_DATA_KEY` sem rotação, sem versionamento e sem escape** — `server/security.js:4`. A chave é derivada por SHA-256 de uma string única, fixada em `const` no carregamento do módulo. Não há identificador de versão de chave nos dados (o prefixo é sempre `v1.`), nem script de recifragem em `server/db/`. Perder a chave é perder definitivamente o conteúdo de nove colunas clínicas; trocá-la é operação sem caminho de volta suportado. É o único risco do repositório que é irreversível.

**2. `psyche_patient_login_identity` sem `row_security=off` derruba o portal do paciente** — `server/db/migrations/008_patient_identity.sql:5`, única das seis funções sem a cláusula. Sob `FORCE ROW LEVEL SECURITY` e sem tenant no login, devolve zero linhas e todo paciente recebe "credenciais inválidas". Módulo inteiro inoperante em produção, sem erro nos logs.

**3. Login com e-mail inexistente quebra e vira oráculo de enumeração** — reproduzido: no modo PostgreSQL, `POST /api/auth/login` com e-mail desconhecido responde `500` porque a auditoria cai no ramo SQLite com `db` nulo (`server/app.js:68`, detalhe em §3, Problema F). E-mail cadastrado com senha errada responde `401`. Essa diferença revela quais e-mails existem na base — enumeração de usuários de graça, num sistema em que o usuário é profissional de saúde identificável. A tentativa também não é auditada.

**4. O papel `psyche_app` nunca é criado** — nenhuma migração e nenhum documento contêm `CREATE ROLE`; `docs/runtime-database-role.md` parte de um `ALTER ROLE psyche_app` sobre um papel que nada cria. Em banco novo, `npm run db:migrate` aborta na `008` deixando o esquema pela metade.

**5. `subscription_provider_plans` com RLS sem policy nega tudo a todos** — `012_commercial_subscriptions.sql`. A tabela é catálogo global, sem `clinic_id`, e recebeu `ENABLE` + `FORCE ROW LEVEL SECURITY` sem nenhuma `CREATE POLICY`: no PostgreSQL isso é negação total, inclusive para o dono. O `GRANT SELECT` da mesma migração é inócuo. Hoje é latente, porque nenhuma rota lê a tabela; vira falha concreta quando o checkout precisar do `provider_plan_id` (§3, Problema G).

**6. A guarda de e-mail duplicado no cadastro público é decorativa** — `server/auth-store.js:19` e `:21` consultam `users` antes de haver tenant, e a RLS devolve zero linhas sempre (§3, Problema H). O `UNIQUE` global evita a conta duplicada, mas o erro só aparece na verificação — depois do e-mail enviado — e chega ao cliente como mensagem crua do PostgreSQL, expondo o nome da constraint.

**7. Autenticação sem MFA, verificação de e-mail ou recuperação de senha** — para prontuário psicológico, o fator único com mínimo de 6 caracteres (`server/security.js:12`) é insuficiente. Uma senha vazada dá acesso direto a conteúdo que está cifrado em repouso mas é legível pela aplicação.

**8. Rate limit de login é inócuo em produção** — `loginAttempts` é um `Map` em memória (`server/app.js:69`). Em Netlify Functions cada instância tem o seu, e instâncias nascem e morrem a cada pico: o limite de 5 tentativas não limita nada, basta distribuir. O mecanismo existe e dá falsa sensação de proteção.

**9. `/api/portal/*` escapa do gate de módulo e de assinatura** — `server/modules.js:20-28` não mapeia essas rotas. Clínica inadimplente, suspensa ou com `communication` desativado continua com o portal do paciente no ar.

**10. Documentação de deploy descreve um health check que não existe mais** — `docs/netlify-deploy.md:88` manda conferir `"legacy_sqlite": false` na resposta de `/api/health`. O endpoint foi reescrito como readiness check e hoje devolve apenas `{"status":"ok","database":"postgresql"}` (`server/app.js:98`). Quem seguir o passo 5 do guia vai concluir que o deploy falhou quando ele está correto. O mesmo commit acrescentou `/api/health/live` e `/api/health/ready`, ainda não documentados.

**11. Dois esquemas paralelos mantidos à mão** — `server/database.js` (SQLite, `CREATE TABLE IF NOT EXISTS` no boot mais um `ALTER TABLE` ad-hoc na linha 73) versus `server/db/migrations/*.sql`. Eram 39 tabelas duplicadas em dois dialetos; com as migrações `012`–`014` o PostgreSQL foi a 46 e o espelho SQLite ficou para trás — assinatura comercial, onboarding e aceite legal existem só em um dos lados. A divergência deixou de ser risco e virou fato, sem nenhum teste que compare os dois esquemas.

**12. `server/app.js` é praticamente irrevisável** — 250 linhas com ~55 mil caracteres: 78 rotas encadeadas em `if` dentro de uma única função, com regra de negócio, SQL SQLite, chamada de store e serialização na mesma linha. Várias linhas passam de 3 mil caracteres. É onde vivem as regras de isolamento entre clientes — o código que mais precisa ser lido com atenção é o que mais resiste à leitura. Os problemas 3, 6 e 9 são consequência direta disso.

**13. Os testes não exercitam o banco de produção** — pool falso em todos os stores (§6). A suíte inteira passa verde com os problemas 2, 3, 5 e 6 presentes. A rede de segurança não cobre a camada onde estão os riscos mais caros.

*Menções fora do top 10, todas confirmadas em `docs/pre-migration-readiness.md`:* upload de mídia sem storage de objetos (`patient_documents` guarda `storage_key` para um serviço que não existe); nenhuma observabilidade, alerta ou correlação de log; sem backup testado; `console.error` como única saída de erro do servidor; NFS-e e notificações (e-mail/WhatsApp/SMS) modeladas mas nunca entregues.

---

## 8. Genérico vs. específico do nicho

### Reaproveitável em qualquer SaaS B2B (≈70% do código)

**Fundação multi-tenant** — a peça mais valiosa e a mais difícil de reescrever. `server/db/migrations/002_tenant_rls.sql` + `withTenant()` (`server/db/postgres.js:18`) + tenant derivado só do usuário autenticado formam um padrão completo e correto de isolamento, portável para qualquer domínio trocando o nome de `clinics`.

**Planos, módulos e limites** — `server/modules.js` inteiro é agnóstico: catálogo de módulos, planos com limites, overrides por tenant, gate por rota, enforcement de limite antes de criar recurso e bloqueio por assinatura inativa. Só a lista de nomes de módulo é do domínio.

**Onboarding autônomo e aceite legal** — acrescentado pela migração `014`, é o pedaço mais reaproveitável do trabalho recente e nada tem de clínico: cadastro público com verificação por e-mail, senha hasheada antes da confirmação, token guardado só como hash, expiração, provisionamento transacional do tenant sob RLS e `legal_acceptances` versionado com IP e user agent. Esse último ponto — registrar *qual versão* dos termos a pessoa aceitou — é exigência de LGPD para qualquer SaaS brasileiro, e costuma ser lembrado tarde demais.

**Modelagem de assinatura** — `subscription_invoices`, `subscription_webhook_events` com chave de idempotência por evento e `subscription_change_requests` formam um esqueleto de billing neutro, aplicável a qualquer produto por assinatura.

**Autenticação e RBAC** — `server/security.js` (scrypt, tokens opacos com hash em repouso, AES-256-GCM, validadores) e o mapa de papéis são genéricos. "Profissional só vê os próprios registros" é o padrão *ownership scoping* de qualquer SaaS.

**Agenda** — motor completo e neutro: unidades, salas, regras de horário por unidade e por profissional, disponibilidade, detecção de conflito, confirmação com lembrete e histórico de eventos. Serve consultório, salão, oficina, escritório de advocacia.

**Cadastro de clientes** — `patients` é um CRM: pessoa, perfil, consentimentos (útil para LGPD em qualquer setor), documentos, responsável.

**Financeiro** — razão de receitas/despesas, contas a pagar com parcelamento e recorrência, fornecedores, recibos numerados com código de verificação, notas fiscais. Valores como `bigint` em centavos. Genérico para qualquer prestador de serviço no Brasil.

**Estoque, comunicação, auditoria, relatórios** — itens com saldo e movimentação, conversas com mensagens cifradas, trilha de auditoria, dashboard e relatórios com séries temporais. Nada disso é clínico.

**Infra** — o adaptador serverless, o runner de migrações com checksum e trava de advisory lock, e o padrão `createApp()` servindo três topologias.

### Específico de psicologia (≈30%)

**Prontuário longitudinal** — os cinco tipos de `clinical_records` (`anamnesis`, `case_plan`, `evolution`, `referral`, `closure`) são a estrutura de um caso clínico. O par `visibility record/restricted` implementa uma distinção do Código de Ética do CFP: o que é compartilhável com a pessoa atendida versus material privativo do profissional. Append-only e versionado por decisão normativa, não técnica.

**Documentos psicológicos** — `psychological_documents` com tipos `certificate` e `guidance` materializa a Resolução CFP nº 06/2019. A ausência deliberada de receituário é regra de escopo profissional, reforçada na UI (`src/psychological-documents.js:6`: *"O Psyché não emite prescrição medicamentosa"*). Os três checkboxes obrigatórios de fundamentação, necessidade e revisão são exigência ética codificada em formulário.

**Sessão de atendimento** — `clinical_sessions` com `sud_history_encrypted` (escala SUD, Subjective Units of Distress) e o cronômetro com estímulo bilateral visual e sonoro descrito em `docs/pre-migration-readiness.md` apontam para protocolo de EMDR. É instrumentação terapêutica, não gestão.

**Política de cobrança subordinada à ética** — a regra de que pendência financeira gera aviso ou revisão administrativa, **nunca bloqueio clínico automático**, com exceção explícita para vulnerabilidade, urgência e emergência (`docs/pre-migration-readiness.md`), inverte o comportamento padrão de um SaaS de cobrança. Um SaaS genérico suspende o inadimplente; aqui isso seria falta ética.

**Portal do paciente** — o enquadramento (próxima sessão, materiais terapêuticos, canal seguro com a profissional) é clínico, embora o mecanismo — identidade separada, sessão própria, escopo por dono — seja um portal de cliente reaproveitável.

**Conclusão prática:** extrair um boilerplate SaaS multi-tenant deste repositório é viável e daria trabalho moderado — a fronteira é limpa, com o clínico concentrado em `clinical-store.js`, `document-store.js`, `session-store.js` e nos módulos de UI correspondentes. O caminho inverso (adaptar outro boilerplate para este nicho) custaria mais, porque a modelagem ética não é óbvia para quem não conhece as resoluções do CFP.

---

## 9. Estado: MVP funcional, não pronto para produção

**Não é esqueleto.** A funcionalidade é real e ampla: 78 endpoints, 46 tabelas, 29 módulos de frontend, 148 testes passando, migrações versionadas com checksum, RLS aplicada, cifragem em repouso funcionando (verificada em teste que inspeciona a coluna), RBAC com escopo por dono, limites de plano com enforcement, cadastro autônomo com verificação de e-mail e deploy serverless configurado. Regras de negócio não triviais estão implementadas e testadas: detecção de conflito de agenda contra regras de horário de unidade **e** de profissional, numeração sequencial de recibos com advisory lock por ano, prontuário append-only versionado, imutabilidade de sessão finalizada, integração de baixa de conta a pagar com o razão, e provisionamento transacional de um tenant novo sob RLS.

**Também não está pronto para produção**, e por três motivos que não são questão de polimento:

**Primeiro, o caminho crítico ainda não fecha.** Os problemas 2, 3 e 4 de §7 estão todos no fluxo de entrada: o login do paciente sempre falha por RLS; um login com e-mail inexistente responde `500` e denuncia quais e-mails existem; e `npm run db:migrate` aborta em banco novo por falta do papel `psyche_app`. O segundo eu reproduzi executando o código desta revisão. Nenhum é detectado pela suíte, porque nenhum teste roda contra um PostgreSQL real e quase nenhum percorre as rotas no modo PostgreSQL puro — a configuração de produção. O sistema ainda não foi exercitado na configuração em que vai rodar.

O trabalho recente fechou parte da lacuna e merece registro: a migração `011` concedeu as permissões que faltavam a `psyche_app`, `check-runtime-role.js` verifica que o runtime não roda como superusuário, `/api/health/live` e `/ready` separam liveness de readiness, e o tratamento de erro passou a devolver `500` genérico com `request_id` em vez de vazar `error.message`. As migrações `012`–`014` acrescentaram cobrança e onboarding — e, com eles, dois defeitos novos do mesmo tipo (problemas 5 e 6 de §7): RLS sem policy e consulta pré-tenant cega por RLS. O padrão se repete porque a causa é a mesma — **nada executa SQL contra um PostgreSQL real antes do deploy**.

**Segundo, a postura de segurança está abaixo do que o dado exige.** Prontuário psicológico é dado sensível sob a LGPD. O sistema entrega cifragem em repouso e auditoria — bom — mas com fator único de autenticação, senha de 6 caracteres, rate limit que não limita em serverless, sem recuperação de senha, sem MFA e sem chave de cifragem rotacionável. Para um CRM de vendas isso passa; para prontuário, não.

**Terceiro, faltam as operações.** Sem observabilidade, sem alerta, sem backup testado, sem restauração ensaiada, sem storage para os documentos que a UI já oferece anexar. `docs/pre-migration-readiness.md` é honesto sobre isso e o projeto acerta em não apresentar esses recursos como ativos.

**Distância estimada até produção:** os defeitos de migração são correções de poucas linhas cada — uma `015` com `CREATE OR REPLACE` de `psyche_patient_login_identity` e `DROP` da RLS de `subscription_provider_plans`, mais o ajuste do `audit` e das consultas pré-tenant. O custo real não está neles: está em montar um ambiente de homologação com PostgreSQL de verdade e uma suíte de integração que exercite RLS, funções `SECURITY DEFINER` e o fluxo de cadastro ponta a ponta. Sem isso, cada leva de migrações vai continuar entregando esse mesmo tipo de erro invisível. Somando MFA e recuperação de senha, a conexão do provedor de pagamento, storage de objetos, backup testado e observabilidade mínima, o caminho é de semanas de trabalho focado, não de meses de reescrita. A fundação é sólida; o que falta é a camada que separa "funciona na minha máquina" de "posso responder por isso quando cair".
