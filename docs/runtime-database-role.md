# Role PostgreSQL do runtime

O Psyché deve usar duas credenciais distintas:

- `PSYCHE_DATABASE_URL`: role `psyche_app`, usada exclusivamente pela API;
- `PSYCHE_MIGRATION_DATABASE_URL`: role administrativa, usada somente por migrações locais ou CI protegido.

## Ativação

1. Aplique as migrações com a credencial administrativa:

   ```bash
   npm run db:migrate
   ```

2. No SQL Editor do Supabase, defina uma senha aleatória e exclusiva:

   ```sql
   ALTER ROLE psyche_app WITH LOGIN PASSWORD 'SUBSTITUA_POR_UMA_SENHA_FORTE';
   ```

3. Monte a URI do Shared Transaction Pooler usando:

   - usuário: `psyche_app.<project-ref>`;
   - host do pooler do projeto;
   - porta `6543`;
   - banco `postgres`.

4. Configure essa URI como `PSYCHE_DATABASE_URL` no Netlify. Não configure
   `PSYCHE_MIGRATION_DATABASE_URL` no runtime.

5. Valide antes do deploy:

   ```bash
   npm run db:check-role
   ```

O resultado seguro contém `role: "psyche_app"`, `bypass_rls: false` e
`safe: true`. A role `postgres` deve permanecer reservada a administração,
migrações e recuperação.
