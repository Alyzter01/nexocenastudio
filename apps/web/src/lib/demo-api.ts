/**
 * Offline-only, synthetic visual preview. Never sends requests to a server.
 * All content stays in this browser's localStorage; no real authentication.
 */
import {projectSchema} from '../../../../packages/core/src/schema.js';

type Scene={id:string;title:string;prompt:string;duration:number;approved:boolean;mediaId:null};
type Project={id:string;name:string;description:string;script:string;ratio:'9:16'|'16:9'|'1:1'|'4:5';status:'draft'|'in_progress'|'completed';videoProvider:'runway'|'google_flow';scenes:Scene[];revision:number;updatedAt:string};
type HistoryItem={projectId:string;projectName:string;revision:number;status:string;event:string;createdAt:string};
type Ledger={balance:number;confirmed:number;revision:number;updatedAt:string};
const P='nexocena:demo-preview:projects:v1';
const C='nexocena:demo-preview:credits:v1';
const H='nexocena:demo-preview:history:v1';
const email='demo@nexocena.local';
const baseProjects:Project[]=[]; // New visits start with a blank workspace; stored projects are never erased.
const now=()=>new Date().toISOString();
function read<T>(key:string,fallback:T):T{try{const stored=localStorage.getItem(key);return stored?JSON.parse(stored) as T:fallback}catch{return fallback}}
function store(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value))}catch{throw Error('Armazenamento do navegador indisponível; exporte um backup JSON')}}
function projects(){return read<Project[]>(P,baseProjects.map(p=>({...p,scenes:p.scenes.map(s=>({...s}))})))}
const saveProjects=(value:Project[])=>store(P,value);
const pushHistory=(item:Project,event:'created'|'updated')=>store(H,[{projectId:item.id,projectName:item.name,revision:item.revision,status:item.status||'draft',event,createdAt:item.updatedAt},...read<HistoryItem[]>(H,[])].slice(0,100));
function body(options:RequestInit){try{return JSON.parse(String(options.body||'{}')) as unknown}catch{throw Error('JSON inválido')}}
function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value)}
function goodBalance(v:unknown){return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=100000000}
export async function demoApi(path:string,options:RequestInit={}):Promise<any>{
 const method=(options.method||'GET').toUpperCase(),url=new URL('http://preview.local/api'+path);
 const pathname=url.pathname.slice('/api'.length);
 if(pathname==='/health')return {api:'demonstration',productionReady:false,offline:true};
 if(pathname==='/auth/config')return {registrationEnabled:false,private:true,experimental:true};
 if(pathname==='/me')return {id:'demo-local-only',email};
 if(pathname==='/auth/logout')return {ok:true};
 if(pathname==='/media'&&method==='GET')return [];
 if(pathname==='/projects'&&method==='GET')return projects();
 if(pathname==='/projects/history'&&method==='GET')return read<HistoryItem[]>(H,[]);
 if(pathname==='/projects'&&method==='POST'){
  const parsed=projectSchema.safeParse(body(options));if(!parsed.success)throw Error('Projeto inválido');
  const item:Project={...parsed.data,id:crypto.randomUUID(),revision:1,updatedAt:now()} as Project;
  saveProjects([item,...projects()]);pushHistory(item,'created');return item;
 }
 const match=/^\/projects\/([0-9a-f-]{36})$/.exec(pathname);
 if(match){
  const id=match[1],list=projects(),index=list.findIndex(p=>p.id===id);
  if(method==='GET'){if(index<0)throw Error('Projeto não encontrado');return list[index]}
  if(method==='DELETE'){if(index<0)throw Error('Projeto não encontrado');saveProjects(list.filter(p=>p.id!==id));return null}
  if(method==='PUT'){
   if(index<0)throw Error('Projeto não encontrado');
   const request=body(options);if(!record(request)||request.revision!==list[index].revision)throw Error('Conflito: revisão desatualizada');
   const parsed=projectSchema.safeParse(request.data);if(!parsed.success)throw Error('Projeto inválido');
   if(parsed.data.scenes.some(s=>s.mediaId||s.approved))throw Error('Mídias indisponíveis na demonstração');
   const updated:Project={...parsed.data,id,revision:list[index].revision+1,updatedAt:now()} as Project;
   list[index]=updated;saveProjects(list);pushHistory(updated,'updated');return updated;
  }
 }
 if(pathname==='/flow/credits'){
  const ledger=read<Ledger>(C,{balance:120,confirmed:0,revision:0,updatedAt:''});
  if(method==='GET')return ledger;
  if(method==='PUT'){
   const request=body(options);
   if(!record(request)||!goodBalance(request.balance)||!goodBalance(request.confirmed)||request.revision!==ledger.revision)throw Error('Créditos alterados em outra sessão');
   const updated={balance:request.balance,confirmed:request.confirmed,revision:ledger.revision+1,updatedAt:now()};
   store(C,updated);return updated;
  }
 }
 throw Error('Recurso indisponível na demonstração offline');
}
