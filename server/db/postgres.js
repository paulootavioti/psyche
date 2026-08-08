import pg from 'pg';
import { existsSync, readFileSync } from 'node:fs';

const{Pool}=pg;

export function postgresPool(connectionString=process.env.PSYCHE_DATABASE_URL){
  if(!connectionString)throw new Error('PSYCHE_DATABASE_URL é obrigatória para PostgreSQL');
  if(process.env.PSYCHE_DB_SSL_CA_PATH&&!existsSync(process.env.PSYCHE_DB_SSL_CA_PATH))throw new Error(`Certificado PostgreSQL não encontrado em ${process.env.PSYCHE_DB_SSL_CA_PATH}. Baixe o arquivo ou remova PSYCHE_DB_SSL_CA_PATH do .env.`);
  const ssl=process.env.PSYCHE_DB_SSL==='false'?false:{rejectUnauthorized:process.env.PSYCHE_DB_SSL_REJECT_UNAUTHORIZED!=='false',...(process.env.PSYCHE_DB_SSL_CA_PATH?{ca:readFileSync(process.env.PSYCHE_DB_SSL_CA_PATH,'utf8')}:{})};
  return new Pool({connectionString,max:Number(process.env.PSYCHE_DB_POOL_SIZE)||10,ssl,application_name:'psyche-api'});
}

export async function withTenant(pool,clinicId,callback){
  if(!/^cln_[a-zA-Z0-9_-]+$/.test(String(clinicId)))throw new Error('Identificador de tenant inválido');
  const client=await pool.connect();
  try{await client.query('BEGIN');await client.query("SELECT set_config('app.clinic_id',$1,true)",[clinicId]);const result=await callback(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}
