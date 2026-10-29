import {matchesContainer} from './security.js';
/** Private Supabase Storage adapter. Never import this module in the browser. */
export const MEDIA_BUCKET='nexocena-media';
const allowed=new Set(['video/mp4','video/webm','image/png','image/jpeg','audio/mpeg','audio/wav','audio/ogg']);
export const MAX_MEDIA_BYTES=50*1024*1024;
export type StorageConfig={url:string;secret:string;bucket:string};
export function storageConfig(env:NodeJS.ProcessEnv=process.env):StorageConfig{
 const url=env.SUPABASE_URL,secret=env.SUPABASE_SECRET_KEY;
 if(!url||!secret)throw new Error('SUPABASE_URL e SUPABASE_SECRET_KEY obrigatórios para armazenamento remoto');
 const origin=new URL(url);
 if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.username||origin.password||origin.search||origin.hash)throw new Error('SUPABASE_URL deve ser origem HTTPS');
 return {url:origin.origin,secret,bucket:env.SUPABASE_STORAGE_BUCKET||MEDIA_BUCKET};
}
function path(c:StorageConfig,id:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('ID de mídia inválido');
 return `${c.url}/storage/v1/object/${encodeURIComponent(c.bucket)}/${id}`;
}
function headers(c:StorageConfig):Record<string,string>{return {apikey:c.secret,...(c.secret.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${c.secret}`})};}
export async function uploadMedia(c:StorageConfig,id:string,bytes:Buffer,mime:string,request:typeof fetch=fetch){
 if(!allowed.has(mime))throw Object.assign(new Error('Formato não permitido'),{statusCode:415});
 if(bytes.length===0||bytes.length>MAX_MEDIA_BYTES)throw Object.assign(new Error('Tamanho de mídia inválido'),{statusCode:413});
 if(!matchesContainer(bytes.subarray(0,32),mime))throw Object.assign(new Error('Assinatura de mídia inválida'),{statusCode:415});
 const response=await request(path(c,id),{redirect:'error',method:'POST',headers:{...headers(c),'Content-Type':mime,'x-upsert':'false'},body:new Uint8Array(bytes.buffer as ArrayBuffer,bytes.byteOffset,bytes.byteLength),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Object.assign(new Error('Falha no armazenamento'),{statusCode:[413,415].includes(response.status)?response.status:502});
}
export async function downloadMedia(c:StorageConfig,id:string,request:typeof fetch=fetch,range?:string){
 const response=await request(path(c,id),{redirect:'error',headers:{...headers(c),...(range?{Range:range}:{})},signal:AbortSignal.timeout(60000)});
 if(!response.ok||!response.body)throw new Error(`Mídia indisponível (${response.status})`);
 return response;
}
export async function deleteMedia(c:StorageConfig,id:string,request:typeof fetch=fetch){
 const objectUrl=path(c,id);const bucketUrl=objectUrl.slice(0,objectUrl.lastIndexOf('/'));
 const response=await request(bucketUrl,{redirect:'error',method:'DELETE',headers:{...headers(c),'Content-Type':'application/json'},body:JSON.stringify({prefixes:[id]}),signal:AbortSignal.timeout(30000)});
 if(!response.ok&&response.status!==404)throw new Error(`Falha ao excluir mídia (${response.status})`);
}

export async function storageHealth(c:StorageConfig,request:typeof fetch=fetch){const res=await request(`${c.url}/storage/v1/bucket/${encodeURIComponent(c.bucket)}`,{redirect:'error',headers:headers(c),signal:AbortSignal.timeout(10000)});if(!res.ok)throw new Error('Storage indisponível');const bucket=await res.json();if(bucket.public!==false)throw new Error('Bucket deve ser privado');return {private:true,maxBytes:Math.min(MAX_MEDIA_BYTES,Number(bucket.file_size_limit)||MAX_MEDIA_BYTES)};}
