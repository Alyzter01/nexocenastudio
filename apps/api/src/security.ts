import {BlockList,isIP} from 'node:net';
import {lookup} from 'node:dns/promises';
import {open} from 'node:fs/promises';
import {z} from 'zod';
export function accessConfig(env:NodeJS.ProcessEnv){
 const mode=z.enum(['private','multiuser']).parse(env.ACCESS_MODE||'private');
 const owner=env.PRIVATE_OWNER_EMAIL?z.email().parse(env.PRIVATE_OWNER_EMAIL).toLowerCase():null;
 if(mode==='private'&&!owner)throw new Error('PRIVATE_OWNER_EMAIL é obrigatório no modo privado');
 const origin=env.APP_ORIGIN?new URL(env.APP_ORIGIN):null;
 if(origin&&(origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password))throw new Error('APP_ORIGIN deve conter somente a origem');
 if(env.NODE_ENV==='production'&&(!origin||origin.protocol!=='https:'))throw new Error('APP_ORIGIN HTTPS é obrigatório em produção');
 return {mode,owner,origin:origin?.origin,registrationEnabled:mode==='multiuser'&&env.REGISTRATION_ENABLED==='true'};
}
export function matchesContainer(bytes:Buffer,mime:string){
 const starts=(values:number[])=>values.every((v,i)=>bytes[i]===v);
 if(mime==='image/png')return starts([137,80,78,71,13,10,26,10]);
 if(mime==='image/jpeg')return starts([255,216,255]);
 if(mime==='video/mp4')return bytes.length>=12&&bytes.toString('ascii',4,8)==='ftyp';
 if(mime==='video/webm')return starts([26,69,223,163]);
 if(mime==='audio/wav')return bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE';
 if(mime==='audio/ogg')return bytes.toString('ascii',0,4)==='OggS';
 if(mime==='audio/mpeg')return bytes.toString('ascii',0,3)==='ID3'||(bytes[0]===255&&(bytes[1]!&224)===224);
 return false;
}
export async function validateStoredMedia(path:string,mime:string){const file=await open(path,'r');try{const bytes=Buffer.alloc(32);const {bytesRead}=await file.read(bytes,0,32,0);return matchesContainer(bytes.subarray(0,bytesRead),mime);}finally{await file.close();}}
const denied=new BlockList();
for(const [ip,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)denied.addSubnet(ip,prefix,'ipv4');
const global6=new BlockList();global6.addSubnet('2000::',3,'ipv6');
for(const [ip,prefix] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]] as const)denied.addSubnet(ip,prefix,'ipv6');
export const publicAddress=(ip:string)=>isIP(ip)===4?!denied.check(ip,'ipv4'):isIP(ip)===6&&global6.check(ip,'ipv6')&&!denied.check(ip,'ipv6');
export type ResolveHost=(hostname:string)=>Promise<{address:string;family:number}[]>;
export async function publicOutputUrl(value:string,hosts:string[],resolve:ResolveHost=host=>lookup(host,{all:true,verbatim:true})){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port||isIP(url.hostname.replaceAll(/[\[\]]/g,''))||!hosts.includes(url.hostname)||url.hostname==='localhost'||url.hostname.endsWith('.localhost')||url.hostname.endsWith('.local'))throw new Error('Destino de vídeo não autorizado');
 let timer:ReturnType<typeof setTimeout>|undefined;let addresses:{address:string;family:number}[];try{addresses=await Promise.race([resolve(url.hostname),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('DNS timeout')),5000)})]);}finally{if(timer)clearTimeout(timer);}
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('Destino de vídeo não público');
 return url;
}
