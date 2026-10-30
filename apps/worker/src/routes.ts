import {constantTimeEqual,expiredCookie,getCookie,passwordHash,randomHex,sessionCookie,sessionUser,sha256,type Env} from './security';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const respond=(value:unknown,status=200,extra:Record<string,string>={})=>new Response(JSON.stringify(value),{status,headers:{...headers,...extra}});
const error=(message:string,status:number)=>respond({error:message},status);
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
async function body(req:Request):Promise<Record<string,unknown>|null>{
 if(Number(req.headers.get('content-length')||0)>200000)return null;
 try{const value:unknown=await req.json();return isObject(value)&&JSON.stringify(value).length<=200000?value:null}catch{return null}
}
const authInput=(v:Record<string,unknown>|null)=>v&&typeof v.email==='string'&&typeof v.password==='string'&&v.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)&&v.password.length>=12&&v.password.length<=128;
const validProject=(v:Record<string,unknown>)=>typeof v.name==='string'&&v.name.trim().length>0&&v.name.length<=150&&JSON.stringify(v).length<=200000&&(!('scenes' in v)||(Array.isArray(v.scenes)&&v.scenes.length<=500));\nconst digits=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=1000000000;
const sameOrigin=(req:Request)=>{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return false;
 const site=req.headers.get('sec-fetch-site');return !site||site==='same-origin'||site==='none';
};
export async function route(req:Request,env:Env):Promise<Response>{
 const path=new URL(req.url).pathname;
 if(path==='/api/health'&&req.method==='GET')return respond({api:'experimental',storage:'d1',auth:'experimental',productionReady:false});
 if(!path.startsWith('/api/'))return error('Não encontrado',404);
 if(!['GET','POST','PUT','DELETE'].includes(req.method))return error('Método não autorizado',405);
 if(!sameOrigin(req))return error('Origem não autorizada',403);
 if(req.method!=='GET'&&req.headers.get('x-nexocena')!=='1')return error('Cabeçalho de segurança ausente',403);
 if(path==='/api/auth/config'&&req.method==='GET')return respond({registrationEnabled:env.EXPERIMENT_REGISTRATION==='true',private:true,experimental:true});
 if(path==='/api/auth/register'&&req.method==='POST'){
  if(env.EXPERIMENT_REGISTRATION!=='true'||!env.EXPERIMENT_OWNER_EMAIL)return error('Cadastro indisponível',403);
  const data=await body(req);if(!authInput(data))return error('Dados inválidos',400);
  const email=String(data.email).trim().toLowerCase();
  if(email!==env.EXPERIMENT_OWNER_EMAIL.toLowerCase())return error('Cadastro não autorizado',403);
  const existing=await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  if(existing)return error('Conta existente',409);
  const id=crypto.randomUUID(),salt=randomHex(16),iterations=310000;
  const hashed=await passwordHash(String(data.password),salt,iterations);
  try{await env.DB.prepare('INSERT INTO users(id,email,password_hash,salt,iterations,created_at) VALUES(?,?,?,?,?,?)').bind(id,email,hashed,salt,iterations,new Date().toISOString()).run()}catch{return error('Cadastro indisponível',409)}
  return respond({id,email},201);
 }
 if(path==='/api/auth/login'&&req.method==='POST'){
  const data=await body(req);if(!authInput(data))return error('Credenciais inválidas',401);
  const email=String(data.email).trim().toLowerCase();
  const user=await env.DB.prepare('SELECT id,password_hash,salt,iterations FROM users WHERE email=?').bind(email).first<{id:string;password_hash:string;salt:string;iterations:number}>();
  // Always perform the KDF, including for nonexistent accounts.
  const computed=await passwordHash(String(data.password),user?.salt||'00000000000000000000000000000000',user?.iterations||310000);
  if(!user||!constantTimeEqual(computed,user.password_hash))return error('Credenciais inválidas',401);
  const token=randomHex(32),hash=await sha256(token);
  await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(hash,user.id,Date.now()+7*86400000).run();
  return respond({id:user.id,email},200,{'set-cookie':sessionCookie(token,req)});
 }
 if(path==='/api/auth/logout'&&req.method==='POST'){
  const token=getCookie(req,'session');if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
  return respond({ok:true},200,{'set-cookie':expiredCookie(req)});
 }
 const userId=await sessionUser(req,env);if(!userId)return error('Entre na sua conta',401);
 if(path==='/api/me'&&req.method==='GET'){
  const row=await env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(userId).first();
  return row?respond(row):error('Entre na sua conta',401);
 }
 if(path==='/api/projects'&&req.method==='GET'){
  const rows=await env.DB.prepare('SELECT id,data,revision,updated_at FROM projects WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200').bind(userId).all();
  return respond((rows.results||[]).map((r:any)=>({id:r.id,...JSON.parse(String(r.data)),revision:r.revision,updatedAt:r.updated_at})));
 }
 if(path==='/api/projects'&&req.method==='POST'){
  const data=await body(req);if(!data||typeof data.name!=='string'||!data.name.trim()||data.name.length>150)return error('Projeto inválido',400);
  const {id:_id,user_id:_owner,revision:_revision,updatedAt:_updated,deleted_at:_deleted,...payload}=data;
  if(!validProject(payload))return error('Projeto inválido',400);
  const project=JSON.stringify(payload),id=crypto.randomUUID(),now=new Date().toISOString();
  await env.DB.prepare('INSERT INTO projects(id,user_id,data,revision,updated_at) VALUES(?,?,?,?,?)').bind(id,userId,project,1,now).run();
  return respond({id,...payload,revision:1,updatedAt:now},201);
 }
 const match=/^\/api\/projects\/([0-9a-f-]{36})$/.exec(path);
 if(match&&req.method==='GET'){
  const row=await env.DB.prepare('SELECT data,revision,updated_at FROM projects WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(match[1],userId).first<{data:string;revision:number;updated_at:string}>();
  return row?respond({id:match[1],...JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at}):error('Projeto não encontrado',404);
 }
 if(match&&req.method==='PUT'){
  const data=await body(req),revision=data?.revision;
  if(!data||!digits(revision)||Number(revision)<1||typeof data.name!=='string'||!data.name.trim()||data.name.length>150)return error('Dados inválidos',400);
  const {revision:_revision,id:_id,user_id:_owner,updatedAt:_updated,deleted_at:_deleted,...project}=data;
  if(!validProject(project))return error('Projeto inválido',400);
  const now=new Date().toISOString();
  const result=await env.DB.prepare('UPDATE projects SET data=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL AND revision=?').bind(JSON.stringify(project),now,match[1],userId,revision).run();
  if(!result.meta.changes)return error('Projeto inexistente ou revisão desatualizada',409);
  return respond({id:match[1],...project,revision:Number(revision)+1,updatedAt:now});
 }
 if(match&&req.method==='DELETE'){
  const revision=Number(new URL(req.url).searchParams.get('revision'));
  if(!digits(revision)||revision<1)return error('Revisão obrigatória',400);
  const result=await env.DB.prepare('UPDATE projects SET deleted_at=?,revision=revision+1 WHERE id=? AND user_id=? AND revision=? AND deleted_at IS NULL').bind(new Date().toISOString(),match[1],userId,revision).run();
  return result.meta.changes?respond({ok:true}):error('Projeto inexistente ou revisão desatualizada',409);
 }
 if(path==='/api/flow/credits'&&req.method==='GET'){
  const row=await env.DB.prepare('SELECT balance,confirmed,revision,updated_at FROM flow_credit_ledgers WHERE user_id=?').bind(userId).first();
  return respond(row||{balance:0,confirmed:0,revision:0,updated_at:null});
 }
 if(path==='/api/flow/credits'&&req.method==='PUT'){
  const data=await body(req);if(!data||!digits(data.balance)||!digits(data.confirmed)||!digits(data.revision))return error('Dados inválidos',400);
  const revision=Number(data.revision),now=new Date().toISOString();
  if(revision===0){
   const result=await env.DB.prepare('INSERT INTO flow_credit_ledgers(user_id,balance,confirmed,revision,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(userId,data.balance,data.confirmed,1,now).run();
   if(!result.meta.changes)return error('Créditos alterados em outra sessão',409);
   return respond({balance:data.balance,confirmed:data.confirmed,revision:1,updated_at:now});
  }
  const result=await env.DB.prepare('UPDATE flow_credit_ledgers SET balance=?,confirmed=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?').bind(data.balance,data.confirmed,now,userId,revision).run();
  if(!result.meta.changes)return error('Créditos alterados em outra sessão',409);
  return respond({balance:data.balance,confirmed:data.confirmed,revision:revision+1,updated_at:now});
 }
 return error('Endpoint experimental indisponível',503);
}
