import {Pool} from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {postgresConfig} from '../apps/api/src/database.js';
const pool=new Pool(postgresConfig(process.env));const client=await pool.connect();
try{await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtextextended('nexocena-migrations',0))");await client.query('CREATE SCHEMA IF NOT EXISTS nexocena_private');await client.query('CREATE TABLE IF NOT EXISTS nexocena_private.schema_migrations(name text primary key, applied_at timestamptz not null default now())');
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort((a,b)=>Number(b.includes('_initial_schema.sql'))-Number(a.includes('_initial_schema.sql'))||a.localeCompare(b))){const exists=await client.query('SELECT 1 FROM nexocena_private.schema_migrations WHERE name=$1',[file]);if(exists.rowCount)continue;await client.query(await readFile(join('supabase/migrations',file),'utf8'));await client.query('INSERT INTO nexocena_private.schema_migrations(name) VALUES($1)',[file]);console.log(`Migration concluída: ${file}`);}
 await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');console.error({code:(e as {code?:string}).code||'unknown'},'Migration error');console.error('Migration falhou; transação revertida. Confira acesso e schema.');process.exitCode=1;}finally{client.release();await pool.end();}
