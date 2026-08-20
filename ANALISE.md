# Análise técnica do Psyché

Análise do branch `claude/configuracao-passo-a-passo-9y80su` sobre `45b4b50` ("reforca seguranca e isolamento PostgreSQL do runtime"). Todos os caminhos, números de linha e comportamentos citados foram verificados executando o código desta revisão.

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
src/                         Frontend: 24 módulos .js + styles.css
  app.js                     Bootstrap, navegação e templates das views
  api.js                     Cliente HTTP único (classe ApiClient)
  backend-integration.js     Ponte entre a UI e a API
  <modulo>.js                agenda, patients, finance, payables, receipts,
                             invoices, inventory, operations, chat, marketing,
                             reports, settings, team, dashboard, schedules,
                             clinical-records, psychological-documents,
                             patient-portal, enhanced
  test/                      14 arquivos Vitest
server/                      Backend
  app.js                     createApp(): 53 rotas num único handler (246 linhas)
  database.js                Esquema SQLite legado + seed
  security.js                AES-256-GCM, scrypt, tokens, validadores
  modules.js                 Catálogo de módulos, planos e gate por rota
  <dominio>-store.js         14 stores PostgreSQL
  db/postgres.js             Fábrica de pool + withTenant()
  db/migrate.js              Runner de migrações com checksum
  db/migrations/*.sql        11 migrações numeradas
  db/transfer-sqlite.js      Importação SQLite → PostgreSQL
  test/                      13 arquivos node:test
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

Fonte de verdade em produção: `server/db/migrations/001_platform.sql` (36 tabelas) e `009_operational_assets.sql` (3 tabelas). O espelho SQLite em `server/database.js` é mantido à mão e diverge (ver §7).

### Plataforma e tenancy

| Tabela | Papel |
|---|---|
| `clinics` | O tenant. Raiz de tudo. |
| `plans` | Catálogo global de planos (única tabela sem `clinic_id`). |
| `clinic_subscriptions` | 1:1 com `clinics` → `plans`; status `trialing/active/past_due/suspended/cancelled`. |
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

Em todas as 53 rotas, o tenant é derivado do usuário autenticado, nunca do corpo ou da query. O padrão é invariável (`server/app.js:78`):

```js
const requireAccess = async (req, res, permission) => {
  const user = await authenticate(req);
  ...
};
```

e em seguida `user.clinic_id` é o primeiro argumento de toda chamada de store. Não encontrei nenhuma rota que aceite `clinic_id` como entrada. Isso elimina de saída a classe mais comum de vazamento entre clientes (IDOR de tenant).

### Camada 2 — Row-Level Security no PostgreSQL

`server/db/migrations/002_tenant_rls.sql` habilita `ENABLE` + **`FORCE ROW LEVEL SECURITY`** em 35 tabelas e `009` acrescenta mais 3 — 38 de 39. A única sem RLS é `plans`, corretamente, por ser catálogo global.

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

**Não existe cobrança.** Não há gateway de pagamento, nem assinatura recorrente, nem qualquer integração financeira externa. Busca por `stripe|pagar|mercadopago|asaas|iugu|checkout|webhook` em `server/` e `src/` não retorna nenhuma integração — só um botão "Pagar" decorativo no template estático do portal (`src/enhanced.js:51`), sem handler.

O que existe é a **modelagem** de um SaaS cobrável, sem o motor de cobrança:

- Catálogo de 4 planos com módulos e limites, em dois lugares — `server/db/migrations/003_seed_plans.sql` e `server/modules.js:12-17`.
- `clinic_subscriptions` com status (`trialing/active/past_due/suspended/cancelled`), `trial_ends_at` e `current_period_ends_at` — campos que nada preenche nem faz avançar.
- Enforcement real de limites antes de criar usuários, unidades e pacientes (`withinTenantLimit`, `server/app.js:79`, aplicado em `:135`, `:169`, `:175`), devolvendo 409.
- Enforcement de módulo e de assinatura inativa por rota.

Ou seja: a plataforma sabe **negar acesso** conforme o plano, mas ninguém consegue **contratar, pagar ou renovar** um plano — não há cadastro autônomo de clínica, cobrança, fatura de assinatura ou webhook de provedor. `clinic_subscriptions` é populado por seed (`server/database.js:80`) com plano `clinic` fixo.

O módulo "financeiro" do produto (`financial_entries`, `receipts`, `fiscal_invoices`, `accounts_payable`) é o financeiro **da clínica com seus pacientes** — não tem relação com a monetização do SaaS. A emissão de NFS-e é apenas registro interno: `fiscal_invoices` tem `provider`, `external_id` e `verification_url`, mas nenhum código chama prefeitura alguma.

---

## 6. Testes

139 testes, todos passando: 63 no backend (`npm run test:server`) e 76 no frontend (`npm test`). O atalho `npm run test:production` encadeia os dois mais o `build`.

### Backend — 13 arquivos, 60 testes

| Arquivo | Testes | Cobre |
|---|---|---|
| `server/test/api.test.js` | 30 | Integração HTTP de ponta a ponta sobre SQLite em memória |
| `server/test/postgres.test.js` | 5 | Imutabilidade das migrações, RLS textual, `withTenant`, configuração do pool |
| `server/test/patient-store.test.js` | 4 | Escopo de tenant e de profissional |
| `server/test/finance-store.test.js` | 3 | Resumo e lançamentos |
| `server/test/serverless.test.js` | 3 | Modo PostgreSQL puro sem abrir SQLite, liveness e readiness |
| demais stores (8 arquivos) | 2 cada | Forma das queries por domínio |
| `server/test/auth-store.test.js` | 2 | Identidade e encerramento do pool |

`api.test.js` é o mais valioso: exercita login, RBAC, isolamento entre clínicas (`:88`), conflito de agenda, centavos inteiros, cifragem em repouso (verifica o prefixo `v1.` direto na coluna), imutabilidade de sessão finalizada e versionamento de prontuário.

### Frontend — 14 arquivos, 76 testes

Vitest com happy-dom e uma API falsa em `src/test/setup.js`. Cobrem renderização, filtros, formulários e fluxos de cada módulo da UI.

### O que os testes não cobrem

Esta é a lacuna decisiva: **nenhum teste toca um PostgreSQL real.** Todos os testes de store injetam um pool falso (`fakePool` em `server/test/patient-store.test.js:5`) que só grava as strings SQL recebidas. Isso valida que a query *menciona* `clinic_id=$1`; não valida que a query é sintaticamente válida, que a coluna existe, que a policy de RLS bloqueia o tenant errado, ou que as funções `SECURITY DEFINER` funcionam. Os problemas de migração descritos em §3 (A e B) passariam ilesos por toda a suíte — e passam.

A lacuna não é só de banco. O problema F de §3 é JavaScript puro, reproduzível em memória e sem dependência externa, e mesmo assim escapa: os 30 testes de `api.test.js` rodam apenas no modo SQLite (`createApp({database: createDatabase(':memory:')})`), então **nenhum teste percorre as rotas no modo PostgreSQL puro** — a configuração que roda em produção.

Também não há: teste do adaptador Netlify (`netlify/functions/api.js` não é exercitado por nada), teste do `db/transfer-sqlite.js`, teste de carga ou de concorrência, e nenhum teste E2E de navegador.

---

## 7. Dívida técnica — os problemas mais graves por risco real

Ordenados por perda de dados, depois segurança, depois indisponibilidade certa. São 11 porque o commit `45b4b50` resolveu um dos originais (os `GRANT` para `psyche_app`, via migração `011`) e abriu outro (a documentação de deploy ficou dessincronizada do health check).

**1. `PSYCHE_DATA_KEY` sem rotação, sem versionamento e sem escape** — `server/security.js:4`. A chave é derivada por SHA-256 de uma string única, fixada em `const` no carregamento do módulo. Não há identificador de versão de chave nos dados (o prefixo é sempre `v1.`), nem script de recifragem em `server/db/`. Perder a chave é perder definitivamente o conteúdo de nove colunas clínicas; trocá-la é operação sem caminho de volta suportado. É o único risco do repositório que é irreversível.

**2. `psyche_patient_login_identity` sem `row_security=off` derruba o portal do paciente** — `server/db/migrations/008_patient_identity.sql:5`, única das seis funções sem a cláusula. Sob `FORCE ROW LEVEL SECURITY` e sem tenant no login, devolve zero linhas e todo paciente recebe "credenciais inválidas". Módulo inteiro inoperante em produção, sem erro nos logs.

**3. Login com e-mail inexistente quebra e vira oráculo de enumeração** — reproduzido: no modo PostgreSQL, `POST /api/auth/login` com e-mail desconhecido responde `500` porque a auditoria cai no ramo SQLite com `db` nulo (`server/app.js:68`, detalhe em §3, Problema F). E-mail cadastrado com senha errada responde `401`. Essa diferença revela quais e-mails existem na base — enumeração de usuários de graça, num sistema em que o usuário é profissional de saúde identificável. A tentativa também não é auditada.

**4. O papel `psyche_app` nunca é criado** — nenhuma migração e nenhum documento contêm `CREATE ROLE`; `docs/runtime-database-role.md` parte de um `ALTER ROLE psyche_app` sobre um papel que nada cria. Em banco novo, `npm run db:migrate` aborta na `008` deixando o esquema pela metade.

**5. Autenticação sem MFA, verificação de e-mail ou recuperação de senha** — para prontuário psicológico, o fator único com mínimo de 6 caracteres (`server/security.js:12`) é insuficiente. Uma senha vazada dá acesso direto a conteúdo que está cifrado em repouso mas é legível pela aplicação.

**6. Rate limit de login é inócuo em produção** — `loginAttempts` é um `Map` em memória (`server/app.js:69`). Em Netlify Functions cada instância tem o seu, e instâncias nascem e morrem a cada pico: o limite de 5 tentativas não limita nada, basta distribuir. O mecanismo existe e dá falsa sensação de proteção.

**7. `/api/portal/*` escapa do gate de módulo e de assinatura** — `server/modules.js:20-28` não mapeia essas rotas. Clínica inadimplente, suspensa ou com `communication` desativado continua com o portal do paciente no ar.

**8. Documentação de deploy descreve um health check que não existe mais** — `docs/netlify-deploy.md:88` manda conferir `"legacy_sqlite": false` na resposta de `/api/health`. O endpoint foi reescrito como readiness check e hoje devolve apenas `{"status":"ok","database":"postgresql"}` (`server/app.js:98`). Quem seguir o passo 5 do guia vai concluir que o deploy falhou quando ele está correto. O mesmo commit acrescentou `/api/health/live` e `/api/health/ready`, ainda não documentados.

**9. Dois esquemas paralelos mantidos à mão** — `server/database.js` (SQLite, `CREATE TABLE IF NOT EXISTS` no boot mais um `ALTER TABLE` ad-hoc na linha 73) versus `server/db/migrations/*.sql`. São 39 tabelas duplicadas em dois dialetos, sem nenhum teste que compare os dois. Toda mudança de esquema precisa ser escrita duas vezes, e a divergência só aparece em produção.

**10. `server/app.js` é praticamente irrevisável** — 246 linhas com ~50 mil caracteres: 53 rotas encadeadas em `if` dentro de uma única função, com regra de negócio, SQL SQLite, chamada de store e serialização na mesma linha. Várias linhas passam de 3 mil caracteres. É onde vivem as regras de isolamento entre clientes — o código que mais precisa ser lido com atenção é o que mais resiste à leitura. Os problemas 3 e 7 são consequência direta disso.

**11. Os testes não exercitam o banco de produção** — pool falso em todos os stores (§6). A suíte inteira passa verde com os problemas 2, 3 e 4 presentes. A rede de segurança não cobre a camada onde estão os riscos mais caros.

*Menções fora do top 10, todas confirmadas em `docs/pre-migration-readiness.md`:* upload de mídia sem storage de objetos (`patient_documents` guarda `storage_key` para um serviço que não existe); nenhuma observabilidade, alerta ou correlação de log; sem backup testado; `console.error` como única saída de erro do servidor; NFS-e e notificações (e-mail/WhatsApp/SMS) modeladas mas nunca entregues.

---

## 8. Genérico vs. específico do nicho

### Reaproveitável em qualquer SaaS B2B (≈70% do código)

**Fundação multi-tenant** — a peça mais valiosa e a mais difícil de reescrever. `server/db/migrations/002_tenant_rls.sql` + `withTenant()` (`server/db/postgres.js:18`) + tenant derivado só do usuário autenticado formam um padrão completo e correto de isolamento, portável para qualquer domínio trocando o nome de `clinics`.

**Planos, módulos e limites** — `server/modules.js` inteiro é agnóstico: catálogo de módulos, planos com limites, overrides por tenant, gate por rota, enforcement de limite antes de criar recurso e bloqueio por assinatura inativa. Só a lista de nomes de módulo é do domínio.

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

**Não é esqueleto.** A funcionalidade é real e ampla: 53 endpoints, 39 tabelas, 24 módulos de frontend, 136 testes passando, migrações versionadas com checksum, RLS aplicada, cifragem em repouso funcionando (verificada em teste que inspeciona a coluna), RBAC com escopo por dono, limites de plano com enforcement, deploy serverless configurado. Regras de negócio não triviais estão implementadas e testadas: detecção de conflito de agenda contra regras de horário de unidade **e** de profissional, numeração sequencial de recibos com advisory lock por ano, prontuário append-only versionado, imutabilidade de sessão finalizada, integração de baixa de conta a pagar com o razão.

**Também não está pronto para produção**, e por três motivos que não são questão de polimento:

**Primeiro, o caminho crítico ainda não fecha.** Os problemas 2, 3 e 4 de §7 estão todos no fluxo de entrada: o login do paciente sempre falha por RLS; um login com e-mail inexistente responde `500` e denuncia quais e-mails existem; e `npm run db:migrate` aborta em banco novo por falta do papel `psyche_app`. O segundo eu reproduzi executando o código desta revisão. Nenhum é detectado pela suíte, porque nenhum teste roda contra um PostgreSQL real e quase nenhum percorre as rotas no modo PostgreSQL puro — a configuração de produção. O sistema ainda não foi exercitado na configuração em que vai rodar.

O commit `45b4b50` fechou parte dessa lacuna e merece registro: a migração `011` concedeu as permissões que faltavam a `psyche_app`, `check-runtime-role.js` verifica que o runtime não roda como superusuário, `/api/health/live` e `/api/health/ready` separam liveness de readiness, e o tratamento de erro passou a devolver `500` genérico com `request_id` em vez de vazar `error.message`. É movimento na direção certa, e reduz a distância — não a elimina.

**Segundo, a postura de segurança está abaixo do que o dado exige.** Prontuário psicológico é dado sensível sob a LGPD. O sistema entrega cifragem em repouso e auditoria — bom — mas com fator único de autenticação, senha de 6 caracteres, rate limit que não limita em serverless, sem recuperação de senha, sem MFA e sem chave de cifragem rotacionável. Para um CRM de vendas isso passa; para prontuário, não.

**Terceiro, faltam as operações.** Sem observabilidade, sem alerta, sem backup testado, sem restauração ensaiada, sem storage para os documentos que a UI já oferece anexar. `docs/pre-migration-readiness.md` é honesto sobre isso e o projeto acerta em não apresentar esses recursos como ativos.

**Distância estimada até produção:** os três defeitos de migração são correções de poucas linhas — o custo real é montar um ambiente de homologação com PostgreSQL de verdade e uma suíte de integração que exercite RLS e as funções `SECURITY DEFINER`, sem a qual esses erros continuarão invisíveis. Somando MFA e recuperação de senha, storage de objetos, backup testado e observabilidade mínima, o caminho é de semanas de trabalho focado, não de meses de reescrita. A fundação é sólida; o que falta é a camada que separa "funciona na minha máquina" de "posso responder por isso quando cair".
