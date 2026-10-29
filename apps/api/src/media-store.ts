import {Readable} from 'node:stream';
import {mkdir,writeFile,unlink,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join} from 'node:path';
import {matchesContainer} from './security.js';
import {MAX_MEDIA_BYTES,storageConfig,uploadMedia,downloadMedia,deleteMedia,storageHealth} from './supabase-storage.js';
export {MAX_MEDIA_BYTES};
export interface MediaStore {kind:'supabase'|'local';put(id:string,bytes:Buffer,mime:string):Promise<void>;get(id:string,range?:string):Promise<{body:Readable;status:number;headers:Record<string,string>}>;remove(id:string):Promise<void>;health():Promise<unknown>;}
export async function createMediaStore(directory:string,env:NodeJS.ProcessEnv,request:typeof fetch=fetch):Promise<MediaStore>{
 if(env.SUPABASE_URL||env.SUPABASE_SECRET_KEY){const config=storageConfig(env);return {kind:'supabase',put:(id,b,m)=>uploadMedia(config,id,b,m,request),async get(id,range){const r=await downloadMedia(config,id,request,range);const headers:Record<string,string>={};for(const h of ['content-length','content-range','accept-ranges']){const value=r.headers.get(h);if(value)headers[h]=value;}return {body:Readable.fromWeb(r.body as Parameters<typeof Readable.fromWeb>[0]),status:r.status,headers}},remove:id=>deleteMedia(config,id,request),health:()=>storageHealth(config,request)};}
 if(env.NODE_ENV==='production')throw new Error('Produção exige Supabase Storage');
 const folder=join(directory,'media');await mkdir(folder,{recursive:true,mode:0o700});const path=(id:string)=>{if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('ID inválido');return join(folder,id)};
 return {kind:'local',async put(id,bytes,mime){if(bytes.length>MAX_MEDIA_BYTES||!matchesContainer(bytes.subarray(0,32),mime))throw Object.assign(new Error('Arquivo inválido'),{statusCode:415});await writeFile(path(id),bytes,{flag:'wx',mode:0o600})},async get(id){const size=(await stat(path(id))).size;return {body:createReadStream(path(id)),status:200,headers:{'content-length':String(size)}}},async remove(id){await unlink(path(id)).catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e})},async health(){return {developmentOnly:true}}};
}
