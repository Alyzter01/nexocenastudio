import test from 'node:test';
import assert from 'node:assert/strict';
import {storageConfig,uploadMedia,downloadMedia,deleteMedia,MAX_MEDIA_BYTES} from '../apps/api/src/supabase-storage.js';
test('Supabase storage requires backend-only credentials',()=>{
 assert.throws(()=>storageConfig({SUPABASE_URL:'https://example.supabase.co'}),/obrigatórios/);
 assert.throws(()=>storageConfig({SUPABASE_URL:'http://example.com',SUPABASE_SECRET_KEY:'test'}),/HTTPS/);
});
test('private storage upload validates file and request',async()=>{
 const c={url:'https://example.supabase.co',secret:'test-secret',bucket:'nexocena-media'};
 let called=0;
 const mock=(async(input:URL|string|Request,init?:RequestInit)=>{called++;assert.match(String(input),/storage\/v1\/object\/nexocena-media\//);assert.equal(init?.method,'POST');assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test-secret');return new Response('{}',{status:200})}) as typeof fetch;
 await uploadMedia(c,'11111111-1111-4111-8111-111111111111',Buffer.from('abc'),'image/png',mock);
 assert.equal(called,1);
 await assert.rejects(uploadMedia(c,'11111111-1111-4111-8111-111111111111',Buffer.from('abc'),'text/html',mock),/Formato/);
 await assert.rejects(uploadMedia(c,'11111111-1111-4111-8111-111111111111',Buffer.alloc(MAX_MEDIA_BYTES+1),'image/png',mock),/Tamanho/);
 assert.equal(called,1);
});
test('private storage read and delete use authorization',async()=>{
 const c={url:'https://example.supabase.co',secret:'test',bucket:'nexocena-media'};
 const mock=(async(_input:URL|string|Request,init?:RequestInit)=>{assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test');return new Response('media',{status:200})}) as typeof fetch;
 const response=await downloadMedia(c,'11111111-1111-4111-8111-111111111111',mock);
 assert.equal(await response.text(),'media');
 await deleteMedia(c,'11111111-1111-4111-8111-111111111111',mock);
});
