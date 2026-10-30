import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {route} from '../src/routes';
import {sha256} from '../src/security';
import type {Env,D1Statement} from '../src/env';

function fixture():Env{
 const db=new DatabaseSync(':memory:');
 for(const file of ['0001_initial.sql','0002_auth.sql','0003_auth_throttles.sql','0004_project_versions.sql']){
  db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 }
 return {EXPERIMENT_OWNER_EMAIL:'owner@example.com',EXPERIMENT_REGISTRATION:'true',DB:{
  prepare(sql:string):D1Statement{
   const stmt=db.prepare(sql);let args:(string|number|null)[]=[];
   const bound:D1Statement={
    bind(...values){args=values;return bound},
    async first<T>(){return (stmt.get(...args)??null) as T|null},
    async all<T>(){return {results:stmt.all(...args) as T[]}},
    async run(){return {meta:{changes:Number(stmt.run(...args).changes)}}}
   };
   return bound;
  }
 }};
}
const password='Test-password-1234';
function call(env:Env,path:string,method='GET',payload?:unknown,cookie='',extra:Record<string,string>={}){
 return route(new Request('http://localhost:8787'+path,{
  method,headers:{'x-nexocena':'1',...(cookie?{cookie}:{}),...extra},
  ...(payload===undefined?{}:{body:JSON.stringify(payload)})
 }),env);
}
const data=async(r:Response)=>r.json() as Promise<any>;
test('all remote API routes fail closed unless explicitly enabled',async()=>{
 const env=fixture();
 assert.equal((await route(new Request('https://preview.example.com/api/projects'),env)).status,503);
 assert.equal((await route(new Request('https://preview.example.com/api/health'),env)).status,200);
});
test('auth, CSRF, D1 isolation and compare-and-swap revisions',async()=>{
 const env=fixture();
 assert.equal((await call(env,'/api/projects')).status,401);
 const registration=await call(env,'/api/auth/register','POST',{email:'owner@example.com',password});
 assert.equal(registration.status,201);
 const cookie=(registration.headers.get('set-cookie')||'').split(';')[0];
 assert.match(cookie,/^session=[0-9a-f]{64}$/);
 assert.equal((await call(env,'/api/me','GET',undefined,cookie)).status,200);
 assert.equal((await call(env,'/api/projects','POST',{name:'X'},cookie,{'origin':'https://evil.example'})).status,403);
 assert.equal((await route(new Request('http://localhost:8787/api/projects',{method:'POST',headers:{cookie},body:'{}'}),env)).status,403);
 const createdResult=await call(env,'/api/projects','POST',{name:'Original',ratio:'9:16',scenes:[]},cookie);
 assert.equal(createdResult.status,201);
 const created=await data(createdResult);
 assert.equal(created.revision,1);
 assert.equal(created.status,'draft');
 assert.equal(created.ratio,'9:16');
 assert.equal((await call(env,'/api/projects/'+created.id,'PUT',{revision:1,data:{name:'Novo',status:'in_progress',videoProvider:'google_flow',scenes:[]}},cookie)).status,200);
 assert.equal((await call(env,'/api/projects/'+created.id,'PUT',{revision:1,data:{name:'Antigo',scenes:[]}},cookie)).status,409);
 const history=await data(await call(env,'/api/projects/history','GET',undefined,cookie));
 assert.equal(history.length,2);
 assert.equal(history[0].status,'in_progress');
 assert.equal(history[1].event,'created');
 const scene={id:crypto.randomUUID(),title:'Cena',prompt:'',duration:6,approved:true,mediaId:null};
 assert.equal((await call(env,'/api/projects','POST',{name:'Inválido',scenes:[scene]},cookie)).status,422);
 const otherId=crypto.randomUUID(),token='a'.repeat(64);
 await env.DB.prepare('INSERT INTO users(id,email,password_hash,salt,iterations,created_at) VALUES(?,?,?,?,?,?)')
  .bind(otherId,'other@example.com','unused','unused',310000,new Date().toISOString()).run();
 await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
  .bind(await sha256(token),otherId,Date.now()+100000).run();
 const otherCookie='session='+token;
 assert.equal((await call(env,'/api/projects/'+created.id,'GET',undefined,otherCookie)).status,404);
 assert.equal((await call(env,'/api/projects/'+created.id,'PUT',{revision:2,data:{name:'Exploit',scenes:[]}},otherCookie)).status,409);
 assert.deepEqual(await data(await call(env,'/api/projects','GET',undefined,otherCookie)),[]);
 assert.deepEqual(await data(await call(env,'/api/projects/history','GET',undefined,otherCookie)),[]);
 assert.equal((await call(env,'/api/flow/credits','PUT',{balance:20,confirmed:1,revision:0},cookie)).status,200);
 assert.equal((await call(env,'/api/flow/credits','PUT',{balance:99,confirmed:0,revision:0},cookie)).status,409);
 assert.equal((await data(await call(env,'/api/flow/credits','GET',undefined,otherCookie))).balance,0);
 assert.equal((await call(env,'/api/projects/'+created.id,'DELETE',undefined,otherCookie)).status,404);
 assert.equal((await call(env,'/api/projects/'+created.id,'DELETE',undefined,cookie)).status,204);
 assert.equal((await call(env,'/api/projects/'+created.id,'GET',undefined,cookie)).status,404);
 assert.equal((await call(env,'/api/auth/logout','POST',undefined,cookie)).status,200);
 assert.equal((await call(env,'/api/me','GET',undefined,cookie)).status,401);
});
test('D1 authentication throttling persists across requests',async()=>{
 const env=fixture();
 let status=0;
 for(let n=0;n<11;n++)status=(await call(env,'/api/auth/login','POST',{email:'owner@example.com',password:'wrong-pass-12345'})).status;
 assert.equal(status,429);
});
