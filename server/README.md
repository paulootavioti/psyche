# Backend Psyché

API HTTP baseada nos módulos nativos do Node.js e SQLite. Dados clínicos sensíveis são cifrados com AES-256-GCM antes da persistência.

## Desenvolvimento

1. Copie `.env.example` para `.env` e defina segredos próprios.
2. Exporte as variáveis no terminal ou use o gerenciador de ambiente da implantação.
3. Inicie frontend e API juntos com `npm run dev:all`.

Se preferir processos separados, use `npm run server` em um terminal e `npm run dev` em outro. Durante o desenvolvimento, o Vite encaminha automaticamente chamadas `/api` para `http://127.0.0.1:8787`.

O frontend do Psyché usa a porta fixa `5180`: `http://127.0.0.1:5180`.

Usuário inicial de desenvolvimento: `admin@psyche.local`. A senha é definida por `PSYCHE_ADMIN_PASSWORD`; sem essa variável, usa-se exclusivamente em desenvolvimento `Psyche@2026!`.

## Segurança

- Nunca utilize a chave ou a senha padrão em homologação ou produção.
- Faça backup conjunto do banco e da chave `PSYCHE_DATA_KEY`; sem a chave, os registros clínicos não podem ser recuperados.
- A API limita JSON a 1 MB, valida entradas, aplica RBAC, isolamento por clínica, headers de segurança e trilha de auditoria.
- Uploads de mídia serão implementados em serviço de objetos isolado; eles não devem ser gravados diretamente no SQLite.

## Testes

`npm run test:server` executa testes HTTP com banco SQLite isolado em memória.
