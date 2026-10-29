import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../apps/api/src/server.js';
import {ProviderError,runwayProvider,type VideoProvider} from '../packages/ai-providers/src/runway.js';
process.env.NODE_ENV='test';process.env.ACCESS_MODE='multiuser';process.env.REGISTRATION_ENABLED='true';process.env.RUNWAY_DAILY_CREDIT_LIMIT='1000';
// Provedor explicitamente simulado: estes testes nunca fazem geração paga.
test('Runway: payload oficial, timeout/erros ambíguos e ausência de reenvio',async()=>{
 let calls=0;
 const provider=runwayProvider({RUNWAY_GENERATION_ENABLED:'true',RUNWAYML_API_SECRET:'fixture-only',RUNWAY_CREDITS_PER_SECOND:'12'},async(url,options)=>{calls++;assert.equal(url,'https://api.dev.runwayml.com/v1/text_to_video');const body=JSON.parse(String(options?.body));assert.deepEqual(body,{model:'gen4.5',promptText:'Uma cidade ao amanhecer',duration:6,ratio:'720:1280'});assert.equal((options?.headers as Record<string,string>)['X-Runway-Version'],'2024-11-06');return Response.json({id:'official-task-fixture'});});
 assert.deepEqual(await provider.submit({prompt:'Uma cidade ao amanhecer',duration:6,ratio:'9:16'}),{id:'official-task-fixture'});assert.equal(calls,1);
 await assert.rejects(()=>provider.submit({prompt:'x',duration:11,ratio:'9:16'}));assert.equal(calls,1);
 let failedCalls=0;const failing=runwayProvider({RUNWAY_GENERATION_ENABLED:'true',RUNWAYML_API_SECRET:'fixture-only',RUNWAY_CREDITS_PER_SECOND:'12'},async()=>{failedCalls++;throw new Error('simulated network timeout')});
 await assert.rejects(()=>failing.submit({prompt:'x',duration:6,ratio:'16:9'}),e=>e instanceof ProviderError&&e.ambiguous);assert.equal(failedCalls,1);
 assert.equal(runwayProvider({}).configured,false);
});
test('geração: confirmação, estimativa, isolamento, deduplicação, polling e retomada',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexocena-video-'));let submissions=0,retrievals=0;
 const provider:VideoProvider={configured:true,creditsPerSecond:12,async submit(){submissions++;return {id:'mock-task'}},async retrieve(){retrievals++;return {id:'mock-task',status:'RUNNING'}}};
 let app=await createApp(dir,provider);
 try{
 const headers={'x-nexocena':'1'};const reg=await app.inject({method:'POST',url:'/api/auth/register',headers,payload:{email:'video@example.com',password:'fixture-password-long'}});const auth={...headers,cookie:`session=${reg.cookies[0].value}`};
 const scene={id:crypto.randomUUID(),title:'Amanhecer',prompt:'Cidade ao amanhecer',duration:6,approved:false,mediaId:null};const data={name:'Produção',ratio:'9:16',scenes:[scene]};
 const p=(await app.inject({method:'POST',url:'/api/projects',headers:auth,payload:data})).json();
 const quote=(await app.inject({method:'POST',url:'/api/video/quotes',headers:auth,payload:{projectId:p.id,sceneId:scene.id}})).json();assert.equal(quote.credits,72,JSON.stringify(quote));assert.equal(submissions,0);
 assert.equal((await app.inject({method:'POST',url:'/api/video/jobs',headers:auth,payload:{quoteId:quote.id,confirmed:false}})).statusCode,400);assert.equal(submissions,0);
 const job=(await app.inject({method:'POST',url:'/api/video/jobs',headers:auth,payload:{quoteId:quote.id,confirmed:true}})).json();assert.equal(job.status,'PENDING');assert.equal(submissions,1);
 const duplicate=(await app.inject({method:'POST',url:'/api/video/jobs',headers:auth,payload:{quoteId:quote.id,confirmed:true}})).json();assert.equal(duplicate.id,job.id);assert.equal(submissions,1);
 const q2=(await app.inject({method:'POST',url:'/api/video/quotes',headers:auth,payload:{projectId:p.id,sceneId:scene.id}})).json();assert.equal((await app.inject({method:'POST',url:'/api/video/jobs',headers:auth,payload:{quoteId:q2.id,confirmed:true}})).statusCode,409);
 await app.inject({url:`/api/video/jobs/${job.id}`,headers:auth});await app.inject({url:`/api/video/jobs/${job.id}`,headers:auth});assert.equal(retrievals,1);
 const other=await app.inject({method:'POST',url:'/api/auth/register',headers,payload:{email:'other-video@example.com',password:'fixture-password-long'}});const outsider={...headers,cookie:`session=${other.cookies[0].value}`};assert.deepEqual((await app.inject({url:'/api/video/jobs',headers:outsider})).json(),[]);assert.equal((await app.inject({url:`/api/video/jobs/${job.id}`,headers:outsider})).statusCode,404);
 await app.close();app=await createApp(dir,provider);assert.equal((await app.inject({url:'/api/video/jobs',headers:auth})).json()[0].status,'RUNNING');assert.equal(submissions,1);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true})}
});
test('provedor ausente: bloqueia estimativas sem acionar rede',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexocena-disabled-'));const app=await createApp(dir,runwayProvider({}));try{const headers={'x-nexocena':'1'};const reg=await app.inject({method:'POST',url:'/api/auth/register',headers,payload:{email:'offline@example.com',password:'fixture-password-long'}});const auth={...headers,cookie:`session=${reg.cookies[0].value}`};assert.equal((await app.inject({url:'/api/video/provider',headers:auth})).json().state,'unavailable');assert.equal((await app.inject({method:'POST',url:'/api/video/quotes',headers:auth,payload:{}})).statusCode,503);}finally{await app.close();rmSync(dir,{recursive:true,force:true})}
});
test('envio incerto permanece reservado após reinício e não gera nova cobrança automaticamente',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexocena-uncertain-'));let calls=0;
 const provider:VideoProvider={configured:true,creditsPerSecond:12,async submit(){calls++;throw new ProviderError(true)},async retrieve(){throw new Error('must not poll without task id')}};
 let app=await createApp(dir,provider);try{
 const headers={'x-nexocena':'1'};const reg=await app.inject({method:'POST',url:'/api/auth/register',headers,payload:{email:'uncertain@example.com',password:'fixture-password-long'}});const auth={...headers,cookie:`session=${reg.cookies[0].value}`};const scene={id:crypto.randomUUID(),title:'Teste',prompt:'Luz na janela',duration:4,approved:false};const data={name:'Teste',ratio:'16:9',scenes:[scene]};const project=(await app.inject({method:'POST',url:'/api/projects',headers:auth,payload:data})).json();
 const estimate=async()=>(await app.inject({method:'POST',url:'/api/video/quotes',headers:auth,payload:{projectId:project.id,sceneId:scene.id}})).json();const quote=await estimate();
 const job=(await app.inject({method:'POST',url:'/api/video/jobs',headers:auth,payload:{quoteId:quote.id,confirmed:true}})).json();assert.equal(job.status,'UNKNOWN');assert.equal(calls,1);
 await app.close();app=await createApp(dir,provider);
 assert.equal((await app.inject({url:'/api/video/jobs',headers:auth})).json()[0].status,'UNKNOWN');const q2=await estimate();assert.equal((await app.inject({method:'POST',url:'/api/video/jobs',headers:auth,payload:{quoteId:q2.id,confirmed:true}})).statusCode,409);assert.equal(calls,1);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true})}
});
test('teto financeiro bloqueia antes do envio e importações maliciosas ou inválidas não deixam mídia',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexocena-import-'));let sends=0,downloads=0;
 const provider:VideoProvider={configured:true,creditsPerSecond:12,async submit(){sends++;return {id:'fixture-import'}},async retrieve(){return {id:'fixture-import',status:'SUCCEEDED',output:['https://cdn.example.com/video.mp4']}}};
 const env={NODE_ENV:'test',ACCESS_MODE:'multiuser',REGISTRATION_ENABLED:'true',RUNWAY_DAILY_CREDIT_LIMIT:'1',RUNWAY_OUTPUT_HOSTS:'cdn.example.com'};
 const downloader={resolve:async()=>[{address:'1.1.1.1',family:4}],request:async(_url:unknown,options?:RequestInit)=>{downloads++;assert.equal(options?.redirect,'error');return new Response('not a video',{status:200})}};
 let app=await createApp(dir,provider,env,downloader);try{
 const headers={'x-nexocena':'1'};const reg=await app.inject({method:'POST',url:'/api/auth/register',headers,payload:{email:'import@example.com',password:'fixture-password-long'}});const auth={...headers,cookie:`session=${reg.cookies[0].value}`};const scene={id:crypto.randomUUID(),title:'Teste',prompt:'Luz',duration:4,approved:false};const p=(await app.inject({method:'POST',url:'/api/projects',headers:auth,payload:{name:'Importação',scenes:[scene]}})).json();const q=(await app.inject({method:'POST',url:'/api/video/quotes',headers:auth,payload:{projectId:p.id,sceneId:scene.id}})).json();
 assert.equal((await app.inject({method:'POST',url:'/api/video/jobs',headers:auth,payload:{quoteId:q.id,confirmed:true}})).statusCode,409);assert.equal(sends,0);
 await app.close();app=await createApp(dir,provider,{...env,RUNWAY_DAILY_CREDIT_LIMIT:'1000'},downloader);
 const job=(await app.inject({method:'POST',url:'/api/video/jobs',headers:auth,payload:{quoteId:q.id,confirmed:true}})).json();await app.inject({url:`/api/video/jobs/${job.id}`,headers:auth});
 const failed=await app.inject({method:'POST',url:`/api/video/jobs/${job.id}/import`,headers:auth,payload:{}});assert.equal(failed.statusCode,502);assert.equal(downloads,1);assert.deepEqual((await app.inject({url:'/api/media',headers:auth})).json(),[]);
 const {readdirSync}=await import('node:fs');assert.deepEqual(readdirSync(join(dir,'media')),[]);
 await app.close();app=await createApp(dir,provider,{...env,RUNWAY_DAILY_CREDIT_LIMIT:'1000',RUNWAY_OUTPUT_HOSTS:'other.example.com'},downloader);assert.equal((await app.inject({method:'POST',url:`/api/video/jobs/${job.id}/import`,headers:auth,payload:{}})).statusCode,503);assert.equal(downloads,1);assert.equal(sends,1);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true})}
});
