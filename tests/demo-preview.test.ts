import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {demoApi} from '../apps/web/src/lib/demo-api';
import {prepareVercel} from '../scripts/prepare-vercel.mjs';

test('demo uses browser storage and never sends network requests',async()=>{
 const map=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
  getItem:(key:string)=>map.get(key)??null,
  setItem:(key:string,value:string)=>{map.set(key,value)},
  removeItem:(key:string)=>{map.delete(key)},
  clear:()=>map.clear(),
  key:(n:number)=>Array.from(map.keys())[n]??null,
  get length(){return map.size}
 }});
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('Demo tried network access')};
 try{
  const session=await demoApi('/me');
  assert.equal(session.email,'demo@nexocena.local');
  const seeded=await demoApi('/projects');
  assert.equal(seeded.length,1);
  assert.equal(seeded[0].ratio,'9:16');
  const created=await demoApi('/projects',{method:'POST',body:JSON.stringify({name:'Novo roteiro',ratio:'9:16',scenes:[]})});
  assert.equal(created.revision,1);
  assert.equal((await demoApi('/projects')).length,2);
  const changed=await demoApi('/projects/'+created.id,{method:'PUT',body:JSON.stringify({revision:1,data:{name:'Atualizado',ratio:'9:16',scenes:[]}})});
  assert.equal(changed.revision,2);
  await assert.rejects(demoApi('/projects/'+created.id,{method:'PUT',body:JSON.stringify({revision:1,data:{name:'Antigo',scenes:[]}})}),/Conflito/);
  const balance=await demoApi('/flow/credits');
  assert.equal(balance.balance,120);
  const saved=await demoApi('/flow/credits',{method:'PUT',body:JSON.stringify({balance:100,confirmed:20,revision:0})});
  assert.equal(saved.revision,1);
  assert.equal((await demoApi('/flow/credits')).balance,100);
  assert.ok(map.size>0);
  await demoApi('/projects/'+created.id,{method:'DELETE'});
  assert.equal((await demoApi('/projects')).length,1);
  await assert.rejects(demoApi('/video/jobs'),/indisponível/);
 }finally{globalThis.fetch=oldFetch}
});

test('Vercel demo build requires no API_ORIGIN and never rewrites to backend',async()=>{
 const tmp=mkdtempSync(join(tmpdir(),'nexocena-demo-'));
 try{
  const source=join(tmp,'dist');mkdirSync(source);
  writeFileSync(join(source,'index.html'),'<html>DEMO</html>');
  const output=join(tmp,'out');
  const config=await prepareVercel(undefined,output,source,true);
  assert.ok(!JSON.stringify(config).includes('/api'));
  assert.ok(!JSON.stringify(config).includes('https://'));
  assert.ok(readFileSync(join(output,'static','index.html'),'utf8').includes('DEMO'));
  await assert.rejects(prepareVercel(undefined,join(tmp,'no-api'),source,false),/API_ORIGIN obrigatório/);
 }finally{rmSync(tmp,{recursive:true,force:true})}
});
