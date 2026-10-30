import type {Env} from './env';
export type {Env} from './env';
const encoder=new TextEncoder();
const toHex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const fromHex=(hex:string)=>new Uint8Array(hex.match(/.{2}/g)?.map(x=>parseInt(x,16))||[]);
export const randomHex=(size:number)=>{const value=new Uint8Array(size);crypto.getRandomValues(value);return toHex(value)};
export async function sha256(value:string){return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))))}
export async function passwordHash(password:string,salt:string,iterations=310000){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return toHex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:fromHex(salt),iterations,hash:'SHA-256'},key,256)));
}
export function constantTimeEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export function getCookie(request:Request,name:string){
 const cookie=request.headers.get('cookie')||'';
 const entry=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
 return entry?entry.slice(name.length+1):null;
}
export async function sessionUser(request:Request,env:Env):Promise<string|null>{
 const token=getCookie(request,'session');
 if(!token||!/^[0-9a-f]{64}$/.test(token))return null;
 const hash=await sha256(token);
 const row=await env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(hash,Date.now()).first<{user_id:string}>();
 return row?.user_id||null;
}
export const sessionCookie=(token:string,request:Request)=>`session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=604800${new URL(request.url).protocol==='https:'?'; Secure':''}`;
export const expiredCookie=(request:Request)=>sessionCookie('',request).replace('Max-Age=604800','Max-Age=0');
