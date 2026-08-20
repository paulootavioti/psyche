import pg from 'pg';
import { existsSync, readFileSync } from 'node:fs';

const{Pool}=pg;

export function postgresPool(connectionString=process.env.PSYCHE_DATABASE_URL){
  if(!connectionString)throw new Error('PSYCHE_DATABASE_URL é obrigatória para PostgreSQL');
  if(process.env.PSYCHE_DB_SSL_CA_PATH&&!existsSync(process.env.PSYCHE_DB_SSL_CA_PATH))throw new Error(`Certificado PostgreSQL não encontrado em ${process.env.PSYCHE_DB_SSL_CA_PATH}. Baixe o arquivo ou remova PSYCHE_DB_SSL_CA_PATH do .env.`);
  const ca=process.env.PSYCHE_DB_SSL_CA_PATH?readFileSync(process.env.PSYCHE_DB_SSL_CA_PATH,'utf8'):process.env.PSYCHE_DB_SSL_CA_BASE64?Buffer.from(process.env.PSYCHE_DB_SSL_CA_BASE64,'base64').toString('utf8'):process.env.PSYCHE_DB_SSL_CA?.replace(/\\n/g,'\n');
  const ssl=process.env.PSYCHE_DB_SSL==='false'?false:{rejectUnauthorized:process.env.PSYCHE_DB_SSL_REJECT_UNAUTHORIZED!=='false',...(ca?{ca}:{})};
  const pool=new Pool({connectionString,max:Number(process.env.PSYCHE_DB_POOL_SIZE)||4,ssl,application_name:'psyche-api',idleTimeoutMillis:Number(process.env.PSYCHE_DB_IDLE_TIMEOUT_MS)||30000,connectionTimeoutMillis:Number(process.env.PSYCHE_DB_CONNECT_TIMEOUT_MS)||10000});
  // Uma conexão ociosa encerrada pelo provedor emite `error` no pool. Sem ouvinte, o
  // evento sobe como exceção não tratada e derruba a instância inteira da função.
  pool.on('error',error=>console.error('Conexão PostgreSQL ociosa encerrada:',error.message));
  return pool;
}

export async function withTenant(pool,clinicId,callback){
  if(!/^cln_[a-zA-Z0-9_-]+$/.test(String(clinicId)))throw new Error('Identificador de tenant inválido');
  const client=await pool.connect();
  try{await client.query('BEGIN');await client.query("SELECT set_config('app.clinic_id',$1,true)",[clinicId]);const result=await callback(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}
