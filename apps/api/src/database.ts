import {Pool,type PoolClient,type PoolConfig} from 'pg';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
export type Row=Record<string,unknown>;
export interface Database {
 kind:'postgres'|'sqlite';one(sql:string,...values:unknown[]):Promise<Row|undefined>;all(sql:string,...values:unknown[]):Promise<Row[]>;run(sql:string,...values:unknown[]):Promise<{changes:number}>;
 transaction<T>(fn:(db:Database)=>Promise<T>):Promise<T>;lock(name:string):Promise<void>;close():Promise<void>;
}
export function postgresSql(sql:string){let i=0;return sql.replace(/'(?:''|[^'])*'|\?/g,m=>m==='?'?`$${++i}`:m).replace(/\b(FROM|JOIN|UPDATE|INTO)\s+(users|sessions|projects|versions|media|video_quotes|video_jobs|storage_cleanup|flow_credit_ledgers)\b/gi,'$1 nexocena_private.$2');}
export function postgresConfig(env:NodeJS.ProcessEnv):PoolConfig{
 if(!env.DATABASE_URL)throw new Error('DATABASE_URL obrigatório');let url:URL;try{url=new URL(env.DATABASE_URL)}catch{throw new Error('DATABASE_URL inválido')}if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('DATABASE_URL inválido');
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
 const local=env.NODE_ENV!=='production'&&env.DATABASE_SSL==='false';const max=Number(env.DB_POOL_MAX||2);if(!Number.isInteger(max)||max<1||max>5)throw new Error('DB_POOL_MAX deve estar entre 1 e 5');
 return {connectionString:url.toString(),max,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,statement_timeout:15000,application_name:'nexocena-studio',ssl:local?false:{rejectUnauthorized:true,...(env.DATABASE_SSL_CA?{ca:env.DATABASE_SSL_CA}:{})}};
}
function normalized(row:Row):Row{return Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?v.toISOString():['data','input','output'].includes(k)&&v!==null&&typeof v==='object'?JSON.stringify(v):['expires','last_poll','size','credits'].includes(k)&&typeof v==='string'?Number(v):v]));}
export function postgresDatabase(pool:Pool,client?:PoolClient):Database{
 const executor=client||pool;const all=async(sql:string,values:unknown[])=>{const result=await executor.query(postgresSql(sql),values);return {rows:result.rows.map(normalized),changes:result.rowCount||0};};
 const db:Database={kind:'postgres',async one(sql,...v){return (await all(sql,v)).rows[0]},async all(sql,...v){return (await all(sql,v)).rows},async run(sql,...v){return {changes:(await all(sql,v)).changes}},async lock(name){if(!client)throw new Error('Lock requer transação');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',[name]);},async transaction(fn){if(client)throw new Error('Transação aninhada não suportada');const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(postgresDatabase(pool,c));await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}},async close(){if(!client)await pool.end()}};return db;
}
export async function openDatabase(directory:string,env:NodeJS.ProcessEnv):Promise<Database>{
 if(env.DATABASE_URL){const pool=new Pool(postgresConfig(env));pool.on('error',()=>{console.error('PostgreSQL: conexão ociosa interrompida');});const db=postgresDatabase(pool);try{await db.one('SELECT 1 AS ok');const tables=['users','sessions','projects','versions','media','video_quotes','video_jobs','storage_cleanup','flow_credit_ledgers'];for(const table of tables){const r=await pool.query('SELECT to_regclass($1) AS name',[`nexocena_private.${table}`]);if(!r.rows[0]?.name)throw new Error('Migrations PostgreSQL pendentes');}await pool.query('SELECT deleted_at FROM nexocena_private.projects LIMIT 0');return db;}catch{await db.close();throw new Error('PostgreSQL indisponível ou migrations pendentes');}}
 if(env.NODE_ENV==='production')throw new Error('Produção exige DATABASE_URL; SQLite não é permitido');
 const {DatabaseSync}=await import('node:sqlite');mkdirSync(directory,{recursive:true,mode:0o700});const raw=new DatabaseSync(join(directory,'studio.sqlite'));
 raw.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL,deleted_at TEXT);
 CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,data TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS video_quotes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,project_id TEXT NOT NULL,scene_id TEXT NOT NULL,input TEXT NOT NULL,credits REAL NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS video_jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,quote_id TEXT UNIQUE NOT NULL,project_id TEXT NOT NULL,scene_id TEXT NOT NULL,status TEXT NOT NULL,task_id TEXT,output TEXT,media_id TEXT,error TEXT,last_poll INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS storage_cleanup(id TEXT PRIMARY KEY,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS flow_credit_ledgers(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed>=0),updated_at TEXT NOT NULL);`);
 if(!(raw.prepare('PRAGMA table_info(projects)').all() as {name:string}[]).some(c=>c.name==='deleted_at'))raw.exec('ALTER TABLE projects ADD COLUMN deleted_at TEXT');
 let pending=Promise.resolve();async function gate<T>(fn:()=>Promise<T>){const before=pending;let release!:()=>void;pending=new Promise<void>(r=>release=r);await before;try{return await fn()}finally{release()}}
 function wrapper(inside=false):Database{const execute=<T>(fn:()=>Promise<T>)=>inside?fn():gate(fn);return {kind:'sqlite',one:(sql,...v)=>execute(async()=>raw.prepare(sql).get(...v as never[]) as Row|undefined),all:(sql,...v)=>execute(async()=>raw.prepare(sql).all(...v as never[]) as Row[]),run:(sql,...v)=>execute(async()=>({changes:Number(raw.prepare(sql).run(...v as never[]).changes)})),transaction:fn=>gate(async()=>{raw.exec('BEGIN IMMEDIATE');try{const result=await fn(wrapper(true));raw.exec('COMMIT');return result;}catch(e){raw.exec('ROLLBACK');throw e}}),lock:async()=>{},close:()=>gate(async()=>raw.close())}}
 return wrapper();
}
