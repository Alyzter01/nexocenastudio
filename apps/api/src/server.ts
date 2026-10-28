import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {mkdirSync,createWriteStream,createReadStream,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {z} from 'zod';
import {credentialsSchema,projectSchema} from '../../../packages/core/src/schema.js';
export async function createApp(directory=process.env.DATA_DIR||'.data'){
 mkdirSync(directory,{recursive:true}); mkdirSync(join(directory,'media'),{recursive:true});
 const db=new DatabaseSync(join(directory,'studio.sqlite')); db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,data TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL);`);
 const app=Fastify({logger:process.env.NODE_ENV!=='test',bodyLimit:1024*1024});
 await app.register(cookie); await app.register(rateLimit,{max:120,timeWindow:'1 minute'}); await app.register(multipart,{limits:{fileSize:100*1024*1024,files:1}});
 app.setErrorHandler((error,req,reply)=>{if(error instanceof z.ZodError)return reply.code(400).send({error:'Dados inválidos',details:error.issues});const e=error as Error & {statusCode?:number};req.log.error({err:e},'request failed');return reply.code(e.statusCode||500).send({error:e.statusCode&&e.statusCode<500?e.message:'Erro interno'});});
 const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
 app.addHook('onRequest',async(req,reply)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers['x-nexocena']!=='1')return reply.code(403).send({error:'Cabeçalho de segurança ausente'});
 if(req.url.startsWith('/api/auth/')||req.url==='/api/health')return;
 const session=db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(hash(req.cookies.session||''),Date.now());
 if(!session)return reply.code(401).send({error:'Entre na sua conta'});
 (req as typeof req & {userId:string}).userId=String(session.user_id);
 });
 const uid=(req:unknown)=>(req as {userId:string}).userId;
 app.get('/api/health',async()=>({api:'ready',database:db.prepare('SELECT 1 AS ok').get(),storage:'local',providers:'unavailable',version:'0.1.0'}));
 app.post('/api/auth/:action',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
 const {action}=req.params as {action:string};
 if(action==='logout'){db.prepare('DELETE FROM sessions WHERE token=?').run(hash(req.cookies.session||''));return reply.clearCookie('session',{path:'/'}).send({ok:true});}
 if(!['register','login'].includes(action))return reply.code(404).send({error:'Operação inexistente'});
 const {email,password}=credentialsSchema.parse(req.body);const normalized=email.toLowerCase();let user=db.prepare('SELECT * FROM users WHERE email=?').get(normalized);
 if(action==='register'){
 if(user)return reply.code(409).send({error:'Conta já existente'});const salt=randomBytes(16).toString('hex'); const id=randomUUID();db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,normalized,`${salt}:${scryptSync(password,salt,64).toString('hex')}`);user={id,email:normalized};
 }else{const [salt,stored]=String(user?.password||'').split(':');const candidate=scryptSync(password,salt||'invalid',64);if(!stored||!timingSafeEqual(candidate,Buffer.from(stored,'hex')))return reply.code(401).send({error:'Credenciais inválidas'});}
 const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),String(user!.id),Date.now()+7*86400000);
 return reply.setCookie('session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:604800}).send({id:user!.id,email:normalized});
 });
 app.get('/api/me',async req=>db.prepare('SELECT id,email FROM users WHERE id=?').get(uid(req)));
 app.get('/api/projects',async req=>db.prepare('SELECT * FROM projects WHERE user_id=? ORDER BY updated_at DESC').all(uid(req)).map(row=>({id:row.id,...JSON.parse(String(row.data)),revision:row.revision,updatedAt:row.updated_at})));
 app.post('/api/projects',async(req,reply)=>{const data=projectSchema.parse(req.body);const id=randomUUID();db.prepare('INSERT INTO projects VALUES(?,?,?,?,?)').run(id,uid(req),JSON.stringify(data),1,new Date().toISOString());return reply.code(201).send({id,...data,revision:1});});
 app.put('/api/projects/:id',async(req,reply)=>{const {id}=req.params as {id:string};const input=z.object({revision:z.number().int().positive(),data:projectSchema}).parse(req.body); const result=db.prepare('UPDATE projects SET data=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=?').run(JSON.stringify(input.data),new Date().toISOString(),id,uid(req),input.revision);if(!result.changes)return reply.code(409).send({error:'Conflito: recarregue o projeto antes de salvar'});db.prepare('INSERT INTO versions VALUES(?,?,?,?,?)').run(randomUUID(),id,JSON.stringify(input.data),input.revision+1,new Date().toISOString());return {revision:input.revision+1};});
 app.delete('/api/projects/:id',async(req,reply)=>{db.prepare('DELETE FROM projects WHERE id=? AND user_id=?').run((req.params as {id:string}).id,uid(req));return reply.code(204).send();});
 app.get('/api/media',async req=>db.prepare('SELECT * FROM media WHERE user_id=? ORDER BY created_at DESC').all(uid(req)));
 app.post('/api/media',async(req,reply)=>{const file=await req.file();if(!file)return reply.code(400).send({error:'Selecione um arquivo'});if(!['video/mp4','video/webm','image/png','image/jpeg','audio/mpeg','audio/wav','audio/ogg'].includes(file.mimetype)){file.file.resume();return reply.code(400).send({error:'Formato não permitido'});}const id=randomUUID();const dest=join(directory,'media',id);await pipeline(file.file,createWriteStream(dest,{flags:'wx'}));if(file.file.truncated){unlinkSync(dest);return reply.code(413).send({error:'Limite: 100 MB'});}db.prepare('INSERT INTO media VALUES(?,?,?,?,?,?)').run(id,uid(req),file.filename.slice(0,200),file.mimetype,file.file.bytesRead,new Date().toISOString());return reply.code(201).send({id});});
 app.get('/api/media/:id',async(req,reply)=>{const row=db.prepare('SELECT * FROM media WHERE id=? AND user_id=?').get((req.params as {id:string}).id,uid(req));if(!row)return reply.code(404).send({error:'Mídia não encontrada'});reply.header('X-Content-Type-Options','nosniff').header('Cache-Control','private, no-store').type(String(row.mime));return reply.send(createReadStream(join(directory,'media',String(row.id))));});
 app.addHook('onClose',async()=>db.close());return app;
}
