import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../apps/api/src/server.js';
process.env.NODE_ENV='test';
test('contas, isolamento, revisão, restauração e validação',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexocena-'));let app=await createApp(dir);
 const headers={'x-nexocena':'1'};
 try{
 assert.equal((await app.inject({method:'POST',url:'/api/auth/register',payload:{}})).statusCode,403);
 assert.equal((await app.inject('/api/projects')).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/api/auth/register',headers,payload:{email:'invalid',password:'short'}})).statusCode,400);
 const reg=await app.inject({method:'POST',url:'/api/auth/register',headers,payload:{email:'test@example.com',password:'a-strong-password-123'}});assert.equal(reg.statusCode,200);
 const cookie=reg.cookies[0].value;const auth={...headers,cookie:`session=${cookie}`};
 const data={name:'Filme de teste',script:'Um novo começo.',scenes:[],ratio:'9:16'};
 const created=await app.inject({method:'POST',url:'/api/projects',headers:auth,payload:data});assert.equal(created.statusCode,201);const p=created.json();
 const updated=await app.inject({method:'PUT',url:`/api/projects/${p.id}`,headers:auth,payload:{revision:1,data:{...data,script:'Roteiro revisado'}}});assert.equal(updated.json().revision,2);
 assert.equal((await app.inject({method:'PUT',url:`/api/projects/${p.id}`,headers:auth,payload:{revision:1,data}})).statusCode,409);
 const other=await app.inject({method:'POST',url:'/api/auth/register',headers,payload:{email:'other@example.com',password:'another-strong-pass'}});const otherAuth={...headers,cookie:`session=${other.cookies[0].value}`};
 assert.deepEqual((await app.inject({url:'/api/projects',headers:otherAuth})).json(),[]);
 assert.equal((await app.inject({method:'PUT',url:`/api/projects/${p.id}`,headers:otherAuth,payload:{revision:2,data}})).statusCode,409);
 assert.equal((await app.inject({url:'/api/media/../../etc/passwd',headers:auth})).statusCode,404);
 const boundary='nexocena-test-boundary';
 const fixture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
 const payload=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n`),fixture,Buffer.from(`\r\n--${boundary}--\r\n`)]);
 const uploaded=await app.inject({method:'POST',url:'/api/media',headers:{...auth,'content-type':`multipart/form-data; boundary=${boundary}`},payload});assert.equal(uploaded.statusCode,201);const mediaId=uploaded.json().id;
 const downloaded=await app.inject({url:`/api/media/${mediaId}`,headers:auth});assert.equal(downloaded.statusCode,200);assert.deepEqual(downloaded.rawPayload,fixture);
 assert.equal((await app.inject({url:`/api/media/${mediaId}`,headers:otherAuth})).statusCode,404);
 await app.close();app=await createApp(dir);
 const restored=(await app.inject({url:'/api/projects',headers:auth})).json();assert.equal(restored[0].script,'Roteiro revisado');assert.equal(restored[0].revision,2);
 await app.inject({method:'POST',url:'/api/auth/logout',headers:auth});assert.equal((await app.inject({url:'/api/projects',headers:auth})).statusCode,401);
 const login=await app.inject({method:'POST',url:'/api/auth/login',headers,payload:{email:'test@example.com',password:'a-strong-password-123'}});assert.equal(login.statusCode,200);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true})}
});
