import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { postgresPool } from './postgres.js';

const migrationDirectory=resolve(dirname(fileURLToPath(import.meta.url)),'migrations');
export const checksum=value=>createHash('sha256').update(value).digest('hex');

export async function migrate({pool=postgresPool(),directory=migrationDirectory}={}){
  const client=await pool.connect();
  try{
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())`);
    const files=(await readdir(directory)).filter(name=>/^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    for(const file of files){const sql=await readFile(resolve(directory,file),'utf8'),hash=checksum(sql),existing=(await client.query('SELECT checksum FROM schema_migrations WHERE version=$1',[file])).rows[0];if(existing){if(existing.checksum!==hash)throw new Error(`Migração já aplicada foi alterada: ${file}`);continue;}await client.query('BEGIN');try{await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['psyche_schema_migrations']);await client.query(sql);await client.query('INSERT INTO schema_migrations(version,checksum) VALUES ($1,$2)',[file,hash]);await client.query('COMMIT');process.stdout.write(`Aplicada: ${file}\n`);}catch(error){await client.query('ROLLBACK');throw error;}}
  }finally{client.release();await pool.end();}
}

if(process.argv[1]===fileURLToPath(import.meta.url))migrate().catch(error=>{process.stderr.write(`${error.stack||error.message}\n`);process.exitCode=1;});
