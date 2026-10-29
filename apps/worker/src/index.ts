/**
 * Experimental Cloudflare Worker scaffold.
 * Fail closed: no login, no mutations and no access to D1 until auth is ported.
 * Never expose this as a production API or attach the existing frontend.
 */
interface Env { DB: D1Database }
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}
});
export default {
 async fetch(request:Request,_env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(url.pathname==='/api/health' && request.method==='GET')
   return json({api:'experimental',storage:'d1-not-connected',auth:'not-implemented',productionReady:false});
  return json({error:'Endpoint indisponível: autenticação e autorização ainda não implementadas'},503);
 }
} satisfies ExportedHandler<Env>;
