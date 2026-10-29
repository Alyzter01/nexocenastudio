import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('manifesto Vercel mantém API antes do fallback e não inclui backend no bundle',async()=>{
 // JS build helper tested via dynamic import; no deployment is executed.
 const {prepareVercel}=await import('../scripts/prepare-vercel.mjs');const dir=mkdtempSync(join(tmpdir(),'nexo-vercel-'));try{const source=join(dir,'source');const {mkdirSync}=await import('node:fs');mkdirSync(source);writeFileSync(join(source,'index.html'),'<main>fixture</main>');await assert.rejects(()=>prepareVercel('http://api.example.com',join(dir,'bad'),source));await assert.rejects(()=>prepareVercel('https://nexocenastudio.vercel.app',join(dir,'bad'),source));const config=await prepareVercel('https://backend.example.onrender.com',join(dir,'out'),source);assert.equal(config.routes[0].dest,'https://backend.example.onrender.com/api/$1');assert.equal(config.routes[1].handle,'filesystem');assert.equal(readFileSync(join(dir,'out/static/index.html'),'utf8'),'<main>fixture</main>');}finally{rmSync(dir,{recursive:true,force:true})}
});
