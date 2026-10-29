import type {FastifyInstance} from 'fastify';
import type {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {open,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {ProviderError,videoInput,type VideoProvider} from '../../../packages/ai-providers/src/runway.js';
export function registerGeneration(app:FastifyInstance,db:DatabaseSync,provider:VideoProvider,directory:string){
 db.exec(`CREATE TABLE IF NOT EXISTS video_quotes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,project_id TEXT NOT NULL,scene_id TEXT NOT NULL,input TEXT NOT NULL,credits REAL NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS video_jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,quote_id TEXT UNIQUE NOT NULL,project_id TEXT NOT NULL,scene_id TEXT NOT NULL,status TEXT NOT NULL,task_id TEXT,output TEXT,media_id TEXT,error TEXT,last_poll INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);`);
 const uid=(req:unknown)=>(req as {userId:string}).userId;
 const locks=new Set<string>();
 const visible=(row:Record<string,unknown>)=>({id:row.id,projectId:row.project_id,sceneId:row.scene_id,status:row.status,mediaId:row.media_id,error:row.error,createdAt:row.created_at});
 app.get('/api/video/provider',async()=>({id:'runway',model:'gen4.5',state:provider.configured?'configured_unverified':'unavailable',ratios:['16:9','9:16'],minDuration:2,maxDuration:10,creditsPerSecond:provider.creditsPerSecond,reason:provider.configured?'Configurada; acesso e geração real ainda precisam de validação.':'Configure a chave Runway e a tarifa atual no backend.'}));
 app.post('/api/video/quotes',async(req,reply)=>{
  if(!provider.configured)return reply.code(503).send({error:'Runway não configurada no servidor'});
  const {projectId,sceneId}=z.object({projectId:z.uuid(),sceneId:z.uuid()}).parse(req.body);
  const project=db.prepare('SELECT data FROM projects WHERE id=? AND user_id=?').get(projectId,uid(req));if(!project)return reply.code(404).send({error:'Projeto não encontrado'});
  const data=JSON.parse(String(project.data));const scene=data.scenes.find((s:{id:string})=>s.id===sceneId);if(!scene)return reply.code(404).send({error:'Cena não encontrada'});
  const input=videoInput.parse({prompt:scene.prompt,duration:scene.duration,ratio:data.ratio});const id=randomUUID();const credits=input.duration*provider.creditsPerSecond;const expires=Date.now()+600000;
  db.prepare('INSERT INTO video_quotes VALUES(?,?,?,?,?,?,?)').run(id,uid(req),projectId,sceneId,JSON.stringify(input),credits,expires);
  return {id,provider:'Runway',model:'gen4.5',input,credits,expiresAt:expires,notice:'Estimativa em créditos da API Runway, separada do Google Flow. A cobrança efetiva é definida pelo provedor.'};
 });
 app.post('/api/video/jobs',async(req,reply)=>{
  const {quoteId,confirmed}=z.object({quoteId:z.uuid(),confirmed:z.literal(true)}).parse(req.body);
  const existing=db.prepare('SELECT * FROM video_jobs WHERE quote_id=? AND user_id=?').get(quoteId,uid(req));if(existing)return visible(existing);
  if(!provider.configured)return reply.code(503).send({error:'Runway não configurada'});
  const quote=db.prepare('SELECT * FROM video_quotes WHERE id=? AND user_id=? AND expires>?').get(quoteId,uid(req),Date.now());if(!quote)return reply.code(409).send({error:'Estimativa expirada. Solicite uma nova.'});
  const project=db.prepare('SELECT data FROM projects WHERE id=? AND user_id=?').get(quote.project_id!,uid(req));if(!project)return reply.code(404).send({error:'Projeto não encontrado'});
  const data=JSON.parse(String(project.data));const scene=data.scenes.find((s:{id:string})=>s.id===quote.scene_id);
  if(!scene||JSON.stringify({prompt:scene.prompt.trim(),duration:scene.duration,ratio:data.ratio})!==String(quote.input))return reply.code(409).send({error:'Cena alterada. Solicite uma nova estimativa.'});
  const active=db.prepare("SELECT scene_id FROM video_jobs WHERE user_id=? AND status IN ('SUBMITTING','UNKNOWN','PENDING','RUNNING','THROTTLED')").all(uid(req));
  if(active.length>=2||active.some(j=>j.scene_id===quote.scene_id))return reply.code(409).send({error:'Já existe geração ativa ou envio incerto. Aguarde e consulte as tarefas.'});
  if(Number(quote.credits)!==videoInput.parse(JSON.parse(String(quote.input))).duration*provider.creditsPerSecond)return reply.code(409).send({error:'Tarifa alterada. Solicite uma nova estimativa.'});
  const id=randomUUID();db.prepare('INSERT INTO video_jobs(id,user_id,quote_id,project_id,scene_id,status,created_at) VALUES(?,?,?,?,?,?,?)').run(id,uid(req),quoteId,quote.project_id!,quote.scene_id!,'SUBMITTING',new Date().toISOString());
  try{const task=await provider.submit(videoInput.parse(JSON.parse(String(quote.input))));db.prepare('UPDATE video_jobs SET task_id=?,status=? WHERE id=?').run(task.id,'PENDING',id);}catch(e){const ambiguous=!(e instanceof ProviderError)||e.ambiguous;db.prepare('UPDATE video_jobs SET status=?,error=? WHERE id=?').run(ambiguous?'UNKNOWN':'FAILED',ambiguous?'Envio incerto. Não reenvie: confira o painel Runway.':'Provedor recusou o envio. Confira saldo e acesso.',id);}
  return reply.code(202).send(visible(db.prepare('SELECT * FROM video_jobs WHERE id=?').get(id)!));
 });
 // Uma reserva sem resposta persistida após reinício é incerta; nunca reenviar automaticamente.
 db.prepare("UPDATE video_jobs SET status='UNKNOWN',error='Servidor reiniciado durante envio. Confira o painel Runway antes de gerar novamente.' WHERE status='SUBMITTING'").run();
 app.get('/api/video/jobs',async req=>db.prepare('SELECT * FROM video_jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(uid(req)).map(visible));
 app.get('/api/video/jobs/:id',async(req,reply)=>{
  const id=(req.params as {id:string}).id;let row=db.prepare('SELECT * FROM video_jobs WHERE id=? AND user_id=?').get(id,uid(req));if(!row)return reply.code(404).send({error:'Tarefa não encontrada'});
  if(row.task_id&&['PENDING','THROTTLED','RUNNING'].includes(String(row.status))&&Date.now()-Number(row.last_poll)>=5000&&!locks.has(id)){
   locks.add(id);db.prepare('UPDATE video_jobs SET last_poll=? WHERE id=?').run(Date.now(),id);
   try{const task=await provider.retrieve(String(row.task_id));if(task.id!==row.task_id)throw new Error('Task identity mismatch');db.prepare('UPDATE video_jobs SET status=?,output=?,error=? WHERE id=?').run(task.status,JSON.stringify(task.output||[]),task.status==='FAILED'?'Geração recusada ou falhou no provedor. Consulte o painel Runway.':null,id);}catch{db.prepare('UPDATE video_jobs SET error=? WHERE id=?').run('Consulta temporariamente indisponível. A tarefa não foi reenviada.',id);}finally{locks.delete(id);}
   row=db.prepare('SELECT * FROM video_jobs WHERE id=?').get(id)!;
  }
  return visible(row);
 });
 app.post('/api/video/jobs/:id/import',async(req,reply)=>{
  const id=(req.params as {id:string}).id;const row=db.prepare('SELECT * FROM video_jobs WHERE id=? AND user_id=?').get(id,uid(req));if(!row)return reply.code(404).send({error:'Tarefa não encontrada'});if(row.media_id)return {mediaId:row.media_id};
  if(row.status!=='SUCCEEDED')return reply.code(409).send({error:'Geração ainda não concluída'});
  if(locks.has(id))return reply.code(409).send({error:'Importação em andamento'});
  const outputs=z.array(z.url()).parse(JSON.parse(String(row.output||'[]')));const url=outputs[0]?new URL(outputs[0]):null;
  const hosts=(process.env.RUNWAY_OUTPUT_HOSTS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!url||url.protocol!=='https:'||url.username||url.password||url.port||!hosts.includes(url.hostname))return reply.code(503).send({error:'Configure RUNWAY_OUTPUT_HOSTS com o hostname HTTPS de saída autorizado pelo provedor e libere-o na rede.'});
  locks.add(id);const mediaId=randomUUID();const path=join(directory,'media',mediaId);
  try{
   const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(60000)});if(!response.ok||!response.body)throw new Error();
   const file=await open(path,'wx');let size=0;let header=Buffer.alloc(0);
   try{for await(const chunk of response.body){size+=chunk.length;if(size>100*1024*1024)throw new Error();if(header.length<12)header=Buffer.concat([header,chunk]).subarray(0,12);await file.writeFile(chunk);}}finally{await file.close();}
   if(header.toString('ascii',4,8)!=='ftyp')throw new Error();
   db.prepare('INSERT INTO media VALUES(?,?,?,?,?,?)').run(mediaId,uid(req),`runway-${id}.mp4`,'video/mp4',size,new Date().toISOString());db.prepare('UPDATE video_jobs SET media_id=? WHERE id=?').run(mediaId,id);return {mediaId};
  }catch{await unlink(path).catch(()=>{});return reply.code(502).send({error:'Não foi possível preservar o MP4. Verifique rede, validade do resultado e limite de 100 MB. Nenhuma nova geração foi enviada.'});}finally{locks.delete(id);}
 });
}
