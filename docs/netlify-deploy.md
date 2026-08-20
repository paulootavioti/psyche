# Deploy do Psyché no Netlify

## Arquitetura

- O Vite gera o frontend estático em `dist/`.
- Requisições `/api/*` são encaminhadas para `netlify/functions/api.js`.
- A função reutiliza o mesmo handler do servidor local.
- PostgreSQL é a única fonte de dados em produção.
- O pool é reaproveitado enquanto a instância serverless permanecer aquecida.

## 1. Preparar o banco

Antes do primeiro deploy, execute as migrações usando uma credencial administrativa segura:

```bash
npm run db:migrate
```

Não execute migrações automaticamente durante cada build do Netlify.

## 2. Configurar o site

Conecte o repositório no Netlify. O arquivo `netlify.toml` já define:

- build: `npm run build`;
- publicação: `dist`;
- funções: `netlify/functions`;
- Node.js 22;
- redirect da API antes do fallback da SPA.

## 3. Variáveis protegidas

Cadastre em **Site configuration → Environment variables**:

- `PSYCHE_DATABASE_URL`
- `PSYCHE_DB_SSL=true`
- `PSYCHE_DB_SSL_REJECT_UNAUTHORIZED=true`
- `PSYCHE_DB_POOL_SIZE=4`
- `PSYCHE_DB_IDLE_TIMEOUT_MS=30000`
- `PSYCHE_DB_CONNECT_TIMEOUT_MS=10000`
- `PSYCHE_ADMIN_PASSWORD`
- `PSYCHE_DATA_KEY`
- `PSYCHE_APP_ORIGINS=https://SEU-SITE.netlify.app`
- todos os 14 `PSYCHE_*_STORE=postgres` descritos em `.env.example`

`PSYCHE_DB_POOL_SIZE` é o total por instância da função: os 14 módulos compartilham o mesmo pool. Mantenha o valor baixo, porque instâncias simultâneas somam conexões no limite do provedor.

Se o provedor exigir uma CA privada, configure `PSYCHE_DB_SSL_CA_BASE64`. Para gerar o valor no macOS:

```bash
base64 -i certs/supabase-ca.crt | tr -d '\n'
```

Não configure `PSYCHE_DB_SSL_CA_PATH` no Netlify, pois o certificado local não é enviado ao repositório.

Para gerar uma chave de dados forte:

```bash
openssl rand -base64 48
```

Mantenha `PSYCHE_DATA_KEY` estável. Alterá-la torna dados clínicos já cifrados indisponíveis.

## 4. Domínios e CORS

Use o domínio exato em `PSYCHE_APP_ORIGINS`. Quando adicionar domínio próprio, aceite ambos durante a transição, separados por vírgula:

```text
https://psyche.netlify.app,https://app.seudominio.com.br
```

Deploy previews possuem domínios variáveis e não devem acessar o banco de produção. Crie um contexto de homologação com banco e segredos separados.

## 5. Verificação após o deploy

Confira:

```text
GET https://SEU-SITE.netlify.app/api/health
```

O resultado esperado contém:

```json
{
  "status": "ok",
  "database": "postgresql",
  "legacy_sqlite": false
}
```

Depois valide login, pacientes, agenda, atendimento, financeiro, portal do paciente e logout.

## 6. Checklist de segurança

- Nunca inclua `.env`, certificados ou dumps no Git.
- Use banco separado para produção e homologação.
- Restrinja a credencial da aplicação ao papel `psyche_app` após as migrações.
- Ative backups e recuperação point-in-time no provedor.
- Revise logs da função sem registrar tokens, senhas ou conteúdo clínico.
- Faça rotação planejada de senhas sem alterar inadvertidamente a chave de cifragem.
