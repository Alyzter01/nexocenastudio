import {demoApi} from './demo-api';
export async function api(path:string,options:RequestInit={}){
 if(import.meta.env.VITE_NEXOCENA_PREVIEW_DEMO==='true')return demoApi(path,options);
 const res=await fetch(`/api${path}`,{...options,headers:{'x-nexocena':'1',...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options.headers}});
 if(!res.ok){let msg='Falha de conexão';try{msg=(await res.json()).error}catch{}throw new Error(msg)}
 return res.status===204?null:res.json();
}
