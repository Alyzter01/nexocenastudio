import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {scryptSync,randomUUID} from 'node:crypto';
import {openDatabase} from '../apps/api/src/database.js';
import {createMediaStore} from '../apps/api/src/media-store.js';
import {createApp} from '../apps/api/src/server.js';
import {runwayProvider} from '../packages/ai-providers/src/runway.js';
import {publicOutputUrl,publicAddress,matchesContainer} from '../apps/api/src/security.js';
const headers={'x-nexocena':'1'};
const provider=()=>runwayProvider({});
const openEnv={NODE_ENV:'test',ACCESS_MODE:'multiuser',REGISTRATION_ENABLED:'true'};
const password='fixture-password-long';
async function register(app:Awaited<ReturnType<typeof createApp>>,email:string){const r=await app.inject({method:'POST',url:'/api/auth/register',headers,payload:{email,password}});assert.equal(r.statusCode,200);return {...headers,cookie:`session=${r.cookies[0].value}`};}
test('modo privado: cadastro bloqueado, owner obrigatório, sessão de outro usuário negada e cookies seguros',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexo-private-'));let app=await createApp(dir,provider(),openEnv);
 try{const owner=await register(app,'owner@example.com');const other=await register(app,'other@example.com');await app.close();
 const env={NODE_ENV:'production',ACCESS_MODE:'private',PRIVATE_OWNER_EMAIL:'owner@example.com',APP_ORIGIN:'https://studio.example.com',RUNWAY_GENERATION_ENABLED:'false',RUNWAY_DAILY_CREDIT_LIMIT:'0'};
 app=await createApp(dir,provider(),env,{database:await openDatabase(dir,openEnv),storage:await createMediaStore(dir,openEnv)});
 assert.equal((await app.inject({url:'/api/auth/config'})).json().registrationEnabled,false);
 assert.equal((await app.inject({method:'POST',url:'/api/auth/register',headers,payload:{email:'new@example.com',password}})).statusCode,403);
 assert.equal((await app.inject({url:'/api/projects',headers:owner})).statusCode,200);assert.equal((await app.inject({url:'/api/projects',headers:other})).statusCode,401);
 assert.equal((await app.inject({method:'POST',url:'/api/auth/login',headers,payload:{email:'other@example.com',password}})).statusCode,401);
 const login=await app.inject({method:'POST',url:'/api/auth/login',headers,payload:{email:'owner@example.com',password}});assert.equal(login.statusCode,200);const cookie=String(login.headers['set-cookie']);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/i);
 assert.equal((await app.inject({method:'POST',url:'/api/auth/login',headers:{...headers,origin:'https://evil.example'},payload:{email:'owner@example.com',password}})).statusCode,403);
 assert.equal((await app.inject({url:'/api/projects',headers:owner})).headers['cache-control'],'no-store');
 await assert.rejects(()=>createApp(join(dir,'invalid'),provider(),{NODE_ENV:'production',ACCESS_MODE:'private'}));
 }finally{await app.close();rmSync(dir,{recursive:true,force:true})}
});
test('upload rejeita MIME falso, remove arquivo parcial e não permite mídia estrangeira ou IDs duplicados',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexo-upload-'));const app=await createApp(dir,provider(),openEnv);
 try{const auth=await register(app,'media@example.com');const boundary='test-boundary';const payload=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="evil.png"\r\nContent-Type: image/png\r\n\r\n<script>alert(1)</script>\r\n--${boundary}--\r\n`);
 const result=await app.inject({method:'POST',url:'/api/media',headers:{...auth,'content-type':`multipart/form-data; boundary=${boundary}`},payload});assert.equal(result.statusCode,415);assert.deepEqual(readdirSync(join(dir,'media')),[]);
 const scene={id:randomUUID(),title:'Cena',prompt:'Teste',duration:4,approved:false,mediaId:randomUUID()};
 assert.equal((await app.inject({method:'POST',url:'/api/projects',headers:auth,payload:{name:'Inválido',scenes:[scene]}})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:'/api/projects',headers:auth,payload:{name:'Duplicado',scenes:[{...scene,mediaId:null},{...scene,mediaId:null}]}})).statusCode,400);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true})}
});
test('atualização de projeto e histórico são revertidos juntos se a escrita do histórico falhar',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexo-transaction-'));const app=await createApp(dir,provider(),openEnv);
 try{const auth=await register(app,'history@example.com');const p=(await app.inject({method:'POST',url:'/api/projects',headers:auth,payload:{name:'Original'}})).json();const db=new DatabaseSync(join(dir,'studio.sqlite'));
 try{db.exec("CREATE TRIGGER fail_history BEFORE INSERT ON versions BEGIN SELECT RAISE(ABORT,'fixture failure'); END");assert.equal((await app.inject({method:'PUT',url:`/api/projects/${p.id}`,headers:auth,payload:{revision:1,data:{name:'Alterado'}}})).statusCode,500);const restored=(await app.inject({url:'/api/projects',headers:auth})).json()[0];assert.equal(restored.name,'Original');assert.equal(restored.revision,1);}finally{db.close();}
 }finally{await app.close();rmSync(dir,{recursive:true,force:true})}
});
test('SSRF: exige host exato, HTTPS e DNS público; bloqueia IPs especiais e protocolos maliciosos',async()=>{
 const hosts=['cdn.example.com'];const resolve=async()=>[{address:'1.1.1.1',family:4}];
 assert.equal((await publicOutputUrl('https://cdn.example.com/video.mp4',hosts,resolve)).hostname,'cdn.example.com');
 for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1'])assert.equal(publicAddress(address),false,address);
 for(const url of ['http://cdn.example.com/v','file:///etc/passwd','https://evil.example/v','https://cdn.example.com.evil.example/v','https://user:pass@cdn.example.com/v','https://127.0.0.1/v','https://0x7f000001/v'])await assert.rejects(()=>publicOutputUrl(url,hosts,resolve));
 await assert.rejects(()=>publicOutputUrl('https://cdn.example.com/v',hosts,async()=>[{address:'10.0.0.1',family:4}]));
 assert.equal(matchesContainer(Buffer.from('<html>'),'video/mp4'),false);
});
test('backup online restaura projetos e sessão em novo diretório sem alterar os originais',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexo-backup-'));const target=dir+'-snapshot';let app=await createApp(dir,provider(),openEnv);
 try{const auth=await register(app,'backup@example.com');await app.inject({method:'POST',url:'/api/projects',headers:auth,payload:{name:'Preservado'}});const db=new DatabaseSync(join(dir,'studio.sqlite'));const id=randomUUID();const bytes=Buffer.from([137,80,78,71,13,10,26,10]);const {writeFileSync}=await import('node:fs');writeFileSync(join(dir,'media',id),bytes);const ownerId=(await app.inject({url:'/api/me',headers:auth})).json().id;db.prepare('INSERT INTO media VALUES(?,?,?,?,?,?)').run(id,ownerId,'fixture.png','image/png',bytes.length,new Date().toISOString());db.close();const {backupData}=await import('../scripts/backup.js');await backupData(dir,target);assert.equal((await app.inject({url:'/api/projects',headers:auth})).json()[0].name,'Preservado');await app.close();app=await createApp(target,provider(),openEnv);assert.equal((await app.inject({url:'/api/projects',headers:auth})).json()[0].name,'Preservado');assert.equal((await app.inject({url:'/api/projects',headers:auth})).json()[0].revision,1);assert.deepEqual((await app.inject({url:`/api/media/${id}`,headers:auth})).rawPayload,bytes);await assert.rejects(()=>backupData(dir,target));
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});rmSync(target,{recursive:true,force:true})}
});

test('provisionamento offline cria somente owner e recusa sobrescrever conta existente',async()=>{const dir=mkdtempSync(join(tmpdir(),'nexo-owner-'));const {spawnSync}=await import('node:child_process');const env={...process.env,DATA_DIR:dir,PRIVATE_OWNER_EMAIL:'owner@example.com'};let app:Awaited<ReturnType<typeof createApp>>|undefined;try{const first=spawnSync(process.execPath,['--import','tsx','scripts/create-user.ts'],{env,input:password+'\n',encoding:'utf8'});assert.equal(first.status,0,first.stderr);const db=new DatabaseSync(join(dir,'studio.sqlite'));const stored=String(db.prepare('SELECT password FROM users').get()!.password);assert.equal(stored.includes(password),false);const repeated=spawnSync(process.execPath,['--import','tsx','scripts/create-user.ts'],{env,input:'another-fixture-password',encoding:'utf8'});assert.notEqual(repeated.status,0);assert.equal(db.prepare('SELECT password FROM users').get()!.password,stored);db.close();app=await createApp(dir,provider(),{NODE_ENV:'test',ACCESS_MODE:'private',PRIVATE_OWNER_EMAIL:'owner@example.com'});assert.equal((await app.inject({method:'POST',url:'/api/auth/login',headers,payload:{email:'owner@example.com',password}})).statusCode,200);}finally{await app?.close();rmSync(dir,{recursive:true,force:true})}});
