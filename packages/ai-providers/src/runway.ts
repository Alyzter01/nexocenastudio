import {z} from 'zod';
export const videoInput=z.object({prompt:z.string().trim().min(1).max(1000),duration:z.number().int().min(2).max(10),ratio:z.enum(['16:9','9:16'])});
export type VideoInput=z.infer<typeof videoInput>;
export type Task={id:string;status:'PENDING'|'THROTTLED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';output?:string[]};
export interface VideoProvider{configured:boolean;creditsPerSecond:number;submit(input:VideoInput):Promise<{id:string}>;retrieve(id:string):Promise<Task>}
export class ProviderError extends Error{constructor(public ambiguous:boolean){super(ambiguous?'Envio sem confirmação. Não reenvie: confira a tarefa no painel Runway.':'O provedor recusou a operação. Confira acesso, saldo e limites no painel Runway.')}}
export function runwayProvider(env=process.env,request:typeof fetch=fetch):VideoProvider{
 const key=env.RUNWAYML_API_SECRET;const price=Number(env.RUNWAY_CREDITS_PER_SECOND);
 const configured=env.RUNWAY_GENERATION_ENABLED==='true'&&Boolean(key)&&Number.isFinite(price)&&price>0;
 async function call(path:string,body?:unknown){
  if(!configured)throw new Error('Runway não configurada');
  let res:Response;try{res=await request(`https://api.dev.runwayml.com/v1/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${key}`,'X-Runway-Version':'2024-11-06','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw new ProviderError(Boolean(body));}
  if(!res.ok)throw new ProviderError(Boolean(body)&&(res.status>=500||res.status===408));
  try{return await res.json();}catch{throw new ProviderError(Boolean(body));}
 }
 return {configured,creditsPerSecond:configured?price:0,
 async submit(input){const parsed=videoInput.parse(input);const data=await call('text_to_video',{model:'gen4.5',promptText:parsed.prompt,duration:parsed.duration,ratio:parsed.ratio==='16:9'?'1280:720':'720:1280'});const result=z.object({id:z.string().min(1).max(200)}).safeParse(data);if(!result.success)throw new ProviderError(true);return result.data;},
 async retrieve(id){const data=await call(`tasks/${encodeURIComponent(id)}`);return z.object({id:z.string(),status:z.enum(['PENDING','THROTTLED','RUNNING','SUCCEEDED','FAILED','CANCELLED']),output:z.array(z.url()).optional()}).parse(data);}};
}
