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
 await uploadMedia(c,'11111111-1111-4111-8111-111111111111',Buffer.from([137,80,78,71,13,10,26,10]),'image/png',mock);
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
test('Supabase secret moderna usa somente apikey e nunca segue redirect',async()=>{
 const c={url:'https://example.supabase.co',secret:'sb_secret_fixture',bucket:'nexocena-media'};const request=(async(_u:unknown,init?:RequestInit)=>{const h=init?.headers as Record<string,string>;assert.equal(h.apikey,c.secret);assert.equal(h.Authorization,undefined);assert.equal(init?.redirect,'error');return new Response('file')}) as typeof fetch;await downloadMedia(c,'11111111-1111-4111-8111-111111111111',request);
});
test('exclusão segue contrato oficial bucket + prefixes; health rejeita bucket público',async()=>{
 const {storageHealth}=await import('../apps/api/src/supabase-storage.js');const c={url:'https://example.supabase.co',secret:'fixture',bucket:'nexocena-media'};const id='11111111-1111-4111-8111-111111111111';const request=(async(u:unknown,init?:RequestInit)=>{assert.equal(String(u),'https://example.supabase.co/storage/v1/object/nexocena-media');assert.equal(init?.method,'DELETE');assert.deepEqual(JSON.parse(String(init?.body)),{prefixes:[id]});return Response.json([])}) as typeof fetch;await deleteMedia(c,id,request);await assert.rejects(()=>storageHealth(c,async()=>Response.json({public:true})),/privado/);assert.equal((await storageHealth(c,async()=>Response.json({public:false,file_size_limit:50*1024*1024}))).maxBytes,50*1024*1024);
});
