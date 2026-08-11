import { postgresPool } from './postgres.js';

const pool=postgresPool();

try{
  const{rows}=await pool.query(`
    SELECT current_user AS role,
           rolsuper AS superuser,
           rolbypassrls AS bypass_rls,
           rolcanlogin AS can_login
      FROM pg_roles
     WHERE rolname=current_user
  `);
  const role=rows[0];
  if(!role)throw new Error('Não foi possível identificar a role PostgreSQL');
  const safe=role.role==='psyche_app'&&!role.superuser&&!role.bypass_rls&&role.can_login;
  process.stdout.write(`${JSON.stringify({...role,safe},null,2)}\n`);
  if(!safe){
    process.stderr.write('A conexão não é segura para o runtime. Use psyche_app; reserve postgres para migrações.\n');
    process.exitCode=1;
  }
}finally{
  await pool.end();
}
