/**
 * Runs isolated Cloudflare workerd + D1 integration checks locally.
 * No Cloudflare API tokens, remote migrations, remote deployment or billing.
 * Wrangler is pinned and fetched as a temporary CLI via npx.
 */
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const wrangler='wrangler@4.155.0';
const config='apps/worker/wrangler.local.jsonc';
const state=mkdtempSync(join(tmpdir(),'nexocena-workerd-'));
const port=8789;
const url='http://127.0.0.1:'+port;
const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'};
const cli=(args)=>spawn('npx',['--yes',wrangler,...args],{stdio:['ignore','pipe','pipe'],env});
const getText=async response=>{try{return await response.text()}catch{return ''}};

async function command(args,timeoutMs=120000){
 const process=cli(args);
 const result={out:'',err:''};
 process.stdout.on('data',v=>result.out+=String(v));
 process.stderr.on('data',v=>result.err+=String(v));
 const exit=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{process.kill('SIGKILL');reject(Error('Wrangler timed out: '+args.join(' ')))},timeoutMs);
  process.on('error',e=>{clearTimeout(timer);reject(e)});
  process.on('exit',code=>{clearTimeout(timer);resolve(code)});
 });
 if(exit!==0)throw Error('Wrangler failed ('+exit+'): '+args.join(' ')+'\n'+result.out.slice(-5000)+'\n'+result.err.slice(-5000));
 return result;
}
const fetchJSON=async(path,method='GET',payload,cookie='',headers={})=>{
 const response=await fetch(url+path,{method,headers:{'x-nexocena':'1',...(cookie?{cookie}:{}),...headers},...(payload===undefined?{}:{body:JSON.stringify(payload)})});
 const text=await getText(response);
 let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:response.status,data,cookie:response.headers.get('set-cookie')};
};
async function waitReady(proc){
 for(let i=0;i<90;i++){
  if(proc.exitCode!==null)throw Error('workerd exited early: '+proc.exitCode);
  try{const r=await fetchJSON('/api/health');if(r.status===200)return}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 throw Error('workerd did not become ready');
}
let worker;
try{
 await command(['d1','migrations','apply','nexocena-experimental','--local','--config',config,'--persist-to',state]);
 worker=spawn('npx',['--yes',wrangler,'dev','--local','--config',config,'--ip','127.0.0.1','--port',String(port),'--persist-to',state],{stdio:['ignore','pipe','pipe'],env,detached:true});
 let output='';
 worker.stdout.on('data',v=>output+=String(v));
 worker.stderr.on('data',v=>output+=String(v));
 await waitReady(worker);
 const health=await fetchJSON('/api/health');
 assert.equal(health.data.productionReady,false);
 assert.equal((await fetchJSON('/api/projects')).status,401);
 const password='Local-test-password-1234',email='owner@example.com';
 const started=performance.now();
 assert.equal((await fetchJSON('/api/auth/register','POST',{email,password})).status,403);
 const registration=await fetchJSON('/api/auth/register','POST',{email,password},'',{'x-nexocena-setup':'a'.repeat(64)});
 const registrationMs=Math.round(performance.now()-started);
 assert.equal(registration.status,201,JSON.stringify(registration.data));
 const cookie=registration.cookie?.split(';')[0]||'';
 assert.match(cookie,/^session=[0-9a-f]{64}$/);
 const startLogin=performance.now();
 const login=await fetchJSON('/api/auth/login','POST',{email,password});
 const loginMs=Math.round(performance.now()-startLogin);
 assert.equal(login.status,200,JSON.stringify(login.data));
 assert.equal((await fetchJSON('/api/me','GET',undefined,cookie)).status,200);
 assert.equal((await fetchJSON('/api/projects','POST',{name:'CSRF'},cookie,{'origin':'https://evil.example'})).status,403);
 const created=await fetchJSON('/api/projects','POST',{name:'Local runtime',ratio:'9:16',scenes:[]},cookie);
 assert.equal(created.status,201,JSON.stringify(created.data));
 assert.equal(created.data.status,'draft');
 assert.equal((await fetchJSON('/api/projects/'+created.data.id,'PUT',{revision:1,data:{name:'New',status:'completed',videoProvider:'google_flow',scenes:[]}},cookie)).status,200);
 const history=await fetchJSON('/api/projects/history','GET',undefined,cookie);
 assert.equal(history.status,200);
 assert.equal(history.data.length,2);
 assert.equal(history.data[0].status,'completed');
 assert.equal((await fetchJSON('/api/projects/'+created.data.id,'PUT',{revision:1,data:{name:'Stale',scenes:[]}},cookie)).status,409);
 assert.equal((await fetchJSON('/api/flow/credits','PUT',{balance:25,confirmed:0,revision:0},cookie)).status,200);
 assert.equal((await fetchJSON('/api/flow/credits','PUT',{balance:99,confirmed:0,revision:0},cookie)).status,409);
 assert.equal((await fetchJSON('/api/auth/logout','POST',undefined,cookie)).status,200);
 assert.equal((await fetchJSON('/api/me','GET',undefined,cookie)).status,401);
 console.log(JSON.stringify({runtime:'workerd-local',d1:'local-migrations',result:'pass',registrationWallMs:registrationMs,loginWallMs:loginMs,cpuMsVerified:false}));
 console.log('NOTE: wall-clock timings are NOT Workers CPU-time; Free-tier CPU performance remains a release blocker.');
}catch(e){
 console.error(String(e));process.exitCode=1;
}finally{
 if(worker&&worker.pid){try{process.kill(-worker.pid,'SIGTERM')}catch{worker.kill('SIGTERM')}}
 rmSync(state,{recursive:true,force:true});
}
