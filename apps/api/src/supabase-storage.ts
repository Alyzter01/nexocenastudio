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
function headers(c:StorageConfig){return {Authorization:`Bearer ${c.secret}`,apikey:c.secret};}
export async function uploadMedia(c:StorageConfig,id:string,bytes:Buffer,mime:string,request:typeof fetch=fetch){
 if(!allowed.has(mime))throw new Error('Formato não permitido');
 if(bytes.length===0||bytes.length>MAX_MEDIA_BYTES)throw new Error('Tamanho de mídia inválido');
 const response=await request(path(c,id),{method:'POST',headers:{...headers(c),'Content-Type':mime,'x-upsert':'false'},body:new Uint8Array(bytes),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Falha no armazenamento (${response.status})`);
}
export async function downloadMedia(c:StorageConfig,id:string,request:typeof fetch=fetch){
 const response=await request(path(c,id),{headers:headers(c),signal:AbortSignal.timeout(60000)});
 if(!response.ok||!response.body)throw new Error(`Mídia indisponível (${response.status})`);
 return response;
}
export async function deleteMedia(c:StorageConfig,id:string,request:typeof fetch=fetch){
 const response=await request(path(c,id),{method:'DELETE',headers:headers(c),signal:AbortSignal.timeout(30000)});
 if(!response.ok&&response.status!==404)throw new Error(`Falha ao excluir mídia (${response.status})`);
}
