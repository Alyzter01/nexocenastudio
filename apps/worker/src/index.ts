import {route} from './routes';
import type {Env} from './security';
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  try{return await route(request,env)}
  catch(error){console.error('worker request failed',{type:error instanceof Error?error.name:'unknown'});return new Response(JSON.stringify({error:'Falha interna'}),{status:500,headers:{'content-type':'application/json','cache-control':'no-store'}})}
 }
};
