import Fastify from 'fastify';
import {accessConfig,type ResolveHost} from './security.js';
import {registerGeneration} from './generation.js';
import {openDatabase,type Database} from './database.js';
import {createMediaStore,MAX_MEDIA_BYTES,type MediaStore} from './media-store.js';
import {runwayProvider,type VideoProvider} from '../../../packages/ai-providers/src/runway.js';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {z} from 'zod';
import {credentialsSchema,projectSchema} from '../../../packages/core/src/schema.js';
export async function createApp(directory=process.env.DATA_DIR||'.data',provider:VideoProvider=runwayProvider(),env:NodeJS.ProcessEnv=process.env,downloads:{request?:typeof fetch;resolve?:ResolveHost;database?:Database;storage?:MediaStore}={}){
 const access=accessConfig(env);
 // Free hosting is fail-closed: paid generations cannot be enabled in production.
 if(env.NODE_ENV==='production'&&(env.RUNWAY_GENERATION_ENABLED!=='false'||Number(env.RUNWAY_DAILY_CREDIT_LIMIT)!==0))throw new Error('Produção gratuita exige Runway desabilitada e teto zero');
 const storage=downloads.storage||await createMediaStore(directory,env);if(storage.kind==='supabase')await storage.health();const db=downloads.database||await openDatabase(directory,env);
 const app=Fastify({logger:env.NODE_ENV!=='test'?{redact:['req.headers.authorization','req.headers.cookie'],serializers:{req:r=>({method:r.method,url:r.url?.split('?')[0]})}}:false,bodyLimit:1024*1024});
 await app.register(cookie);await app.register(rateLimit,{max:120,timeWindow:'1 minute'});await app.register(multipart,{limits:{fileSize:MAX_MEDIA_BYTES,files:1,fields:5}});
 app.setErrorHandler((error,req,reply)=>{if(error instanceof z.ZodError)return reply.code(400).send({error:'Dados inválidos',details:error.issues});const e=error as Error & {statusCode?:number;code?:string};req.log.error({code:e.statusCode||500,type:e.name},'request failed');const status=e.code==='22P02'?400:e.code==='23505'?409:e.code==='23503'?409:e.statusCode||500;return reply.code(status).send({error:status===409?'Recurso em uso ou conflito de dados':'Não foi possível concluir a operação'});});
 let uploading=false;const uploadRequests=new WeakSet<object>();const release=(req:object)=>{if(uploadRequests.has(req)){uploadRequests.delete(req);uploading=false}};
 app.addHook('preHandler',async(req,reply)=>{if(req.method==='POST'&&req.routeOptions.url==='/api/media'){if(uploading)return reply.header('Retry-After','3').code(429).send({error:'Outro upload em andamento'});uploading=true;uploadRequests.add(req)}});
 app.addHook('onResponse',async req=>release(req));app.addHook('onRequestAbort',async req=>release(req));
 const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
 app.addHook('onRequest',async(req,reply)=>{
 reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer');
 if(env.NODE_ENV==='production')reply.header('Strict-Transport-Security','max-age=31536000');
 if(access.origin&&req.headers.origin&&!access.origins.includes(req.headers.origin))return reply.code(403).send({error:'Origem não autorizada'});
 if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers['x-nexocena']!=='1')return reply.code(403).send({error:'Cabeçalho de segurança ausente'});
 if(req.url.startsWith('/api/auth/')||req.url==='/api/health')return;
 const session=await db.one('SELECT sessions.user_id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?',hash(req.cookies.session||''),Date.now());
 if(!session||(access.mode==='private'&&session.email!==access.owner))return reply.code(401).send({error:'Entre na sua conta'});
 (req as typeof req & {userId:string}).userId=String(session.user_id);
 });
 const uid=(req:unknown)=>(req as {userId:string}).userId;
 app.get('/api/health',async(_req,reply)=>{const [database,media]=await Promise.allSettled([db.one('SELECT 1 AS ok'),storage.health()]);const ok=database.status==='fulfilled'&&media.status==='fulfilled';return reply.code(ok?200:503).send({api:ok?'ready':'degraded',database:database.status==='fulfilled'?database.value:{ok:0},storage:media.status==='fulfilled'?storage.kind:'unavailable',providers:provider.configured?'configured_unverified':'unavailable',version:'0.2.0'});});
 app.get('/api/auth/config',async()=>({registrationEnabled:access.registrationEnabled,private:access.mode==='private'}));
 app.post('/api/auth/:action',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
 const {action}=req.params as {action:string};
 if(action==='logout'){await db.run('DELETE FROM sessions WHERE token=?',hash(req.cookies.session||''));return reply.clearCookie('session',{path:'/'}).send({ok:true});}
 if(!['register','login'].includes(action))return reply.code(404).send({error:'Operação inexistente'});
 if(action==='register'&&!access.registrationEnabled)return reply.code(403).send({error:'Cadastro indisponível. Acesso restrito ao proprietário.'});
 const {email,password}=credentialsSchema.parse(req.body);const normalized=email.toLowerCase();let user=await db.one('SELECT * FROM users WHERE email=?',normalized);
 if(access.mode==='private'&&normalized!==access.owner){scryptSync(password,'private-login',64);return reply.code(401).send({error:'Credenciais inválidas'});}
 if(action==='register'){
 if(user)return reply.code(409).send({error:'Conta já existente'});const salt=randomBytes(16).toString('hex');const id=randomUUID();await db.run('INSERT INTO users(id,email,password) VALUES(?,?,?)',id,normalized,`${salt}:${scryptSync(password,salt,64).toString('hex')}`);user={id,email:normalized};
 }else{const [salt,stored]=String(user?.password||'').split(':');const candidate=scryptSync(password,salt||'invalid',64);if(!stored||Buffer.from(stored,'hex').length!==candidate.length||!timingSafeEqual(candidate,Buffer.from(stored,'hex')))return reply.code(401).send({error:'Credenciais inválidas'});}
 const token=randomBytes(32).toString('hex');await db.run('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)',hash(token),String(user!.id),Date.now()+7*86400000);
 return reply.setCookie('session',token,{httpOnly:true,sameSite:'lax',secure:env.NODE_ENV==='production',path:'/',maxAge:604800}).send({id:user!.id,email:normalized});
 });
 app.get('/api/me',async req=>db.one('SELECT id,email FROM users WHERE id=?',uid(req)));
 // Google Flow credit estimates are user-entered planning values, not actual Google billing.
 const flowLedgerSchema=z.object({balance:z.number().int().min(0).max(100000000),confirmed:z.number().int().min(0).max(100000000)}).strict();
 app.get('/api/flow/credits',async req=>{const row=await db.one('SELECT balance,confirmed,updated_at FROM flow_credit_ledgers WHERE user_id=?',uid(req));return row?{balance:Number(row.balance),confirmed:Number(row.confirmed),updatedAt:String(row.updated_at)}:{balance:0,confirmed:0,updatedAt:''};});
 app.put('/api/flow/credits',async req=>{const data=flowLedgerSchema.parse(req.body);const now=new Date().toISOString();await db.run('INSERT INTO flow_credit_ledgers(user_id,balance,confirmed,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET balance=excluded.balance,confirmed=excluded.confirmed,updated_at=excluded.updated_at',uid(req),data.balance,data.confirmed,now);return {...data,updatedAt:now};});

 app.get('/api/projects',async req=>(await db.all('SELECT * FROM projects WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC',uid(req))).map(row=>({id:row.id,...JSON.parse(String(row.data)),revision:row.revision,updatedAt:row.updated_at})));
 async function validateProjectMedia(data:z.infer<typeof projectSchema>,userId:string,connection=db){for(const scene of data.scenes){if((scene.approved&&!scene.mediaId)||(scene.mediaId&&!await connection.one('SELECT id FROM media WHERE id=? AND user_id=?',scene.mediaId,userId)))throw Object.assign(new Error('Mídia inválida'),{statusCode:400});}}
 app.post('/api/projects',async(req,reply)=>{const data=projectSchema.parse(req.body);const id=randomUUID();await db.transaction(async tx=>{await tx.lock('media:'+uid(req));await validateProjectMedia(data,uid(req),tx);await tx.run('INSERT INTO projects(id,user_id,data,revision,updated_at) VALUES(?,?,?,?,?)',id,uid(req),JSON.stringify(data),1,new Date().toISOString());});return reply.code(201).send({id,...data,revision:1});});
 app.put('/api/projects/:id',async(req,reply)=>{const {id}=z.object({id:z.uuid()}).parse(req.params);const input=z.object({revision:z.number().int().positive(),data:projectSchema}).parse(req.body);const changed=await db.transaction(async tx=>{await tx.lock('media:'+uid(req));await validateProjectMedia(input.data,uid(req),tx);const result=await tx.run('UPDATE projects SET data=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=? AND deleted_at IS NULL',JSON.stringify(input.data),new Date().toISOString(),id,uid(req),input.revision);if(!result.changes)return false;await tx.run('INSERT INTO versions(id,project_id,data,revision,created_at) VALUES(?,?,?,?,?)',randomUUID(),id,JSON.stringify(input.data),input.revision+1,new Date().toISOString());return true;});if(!changed)return reply.code(409).send({error:'Conflito: recarregue o projeto antes de salvar'});return {revision:input.revision+1};});
 app.delete('/api/projects/:id',async(req,reply)=>{await db.run('UPDATE projects SET deleted_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL',new Date().toISOString(),(req.params as {id:string}).id,uid(req));return reply.code(204).send();});
 app.get('/api/media',async req=>db.all('SELECT * FROM media WHERE user_id=? ORDER BY created_at DESC',uid(req)));
 app.post('/api/media',async(req,reply)=>{const file=await req.file();if(!file)return reply.code(400).send({error:'Selecione um arquivo'});const id=randomUUID();const bytes=await file.toBuffer();
 // Intent is durable before upload: failures/timeouts can be reconciled without losing ownership.
 await db.run('INSERT INTO storage_cleanup(id,created_at) VALUES(?,?)',id,new Date().toISOString());
 try{await storage.put(id,bytes,file.mimetype);await db.transaction(async tx=>{await tx.run('INSERT INTO media(id,user_id,name,mime,size,created_at) VALUES(?,?,?,?,?,?)',id,uid(req),file.filename.slice(0,200),file.mimetype,bytes.length,new Date().toISOString());await tx.run('DELETE FROM storage_cleanup WHERE id=?',id);});}catch(e){let saved;try{saved=await db.one('SELECT id FROM media WHERE id=? AND user_id=?',id,uid(req));}catch{throw e;}if(saved)return reply.code(201).send({id});await storage.remove(id).catch(()=>{});throw e;}return reply.code(201).send({id});});
 app.get('/api/media/:id',async(req,reply)=>{const {id}=z.object({id:z.uuid()}).parse(req.params);const row=await db.one('SELECT * FROM media WHERE id=? AND user_id=?',id,uid(req));if(!row)return reply.code(404).send({error:'Mídia não encontrada'});const range=req.headers.range;if(range&&!/^bytes=\d*-\d*$/.test(range))return reply.code(416).send({error:'Range inválido'});const result=await storage.get(id,range);reply.code(result.status).headers(result.headers).type(String(row.mime));return reply.send(result.body);});
 app.delete('/api/media/:id',async(req,reply)=>{const {id}=z.object({id:z.uuid()}).parse(req.params);const removed=await db.transaction(async tx=>{await tx.lock('media:'+uid(req));const row=await tx.one('SELECT id FROM media WHERE id=? AND user_id=?',id,uid(req));if(!row)return false;const projects=[...await tx.all('SELECT data FROM projects WHERE user_id=?',uid(req)),...await tx.all('SELECT versions.data FROM versions JOIN projects ON projects.id=versions.project_id WHERE projects.user_id=?',uid(req))];if(projects.some(p=>JSON.parse(String(p.data)).scenes.some((s:{mediaId:string|null})=>s.mediaId===id)))throw Object.assign(new Error('Mídia em uso'),{statusCode:409});await tx.run('INSERT INTO storage_cleanup(id,created_at) VALUES(?,?)',id,new Date().toISOString());await tx.run('UPDATE video_jobs SET media_id=NULL WHERE media_id=? AND user_id=?',id,uid(req));await tx.run('DELETE FROM media WHERE id=? AND user_id=?',id,uid(req));return true;});if(!removed)return reply.code(404).send({error:'Mídia não encontrada'});try{await storage.remove(id);await db.run('DELETE FROM storage_cleanup WHERE id=?',id);}catch{return reply.code(202).send({status:'cleanup_pending'});}return reply.code(204).send();});
 await registerGeneration(app,db,provider,storage,env,downloads);
 app.addHook('onClose',async()=>db.close());return app;
}
