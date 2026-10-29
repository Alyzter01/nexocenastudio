import {mkdir,cp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function prepareVercel(value,output='.vercel/output',source='apps/web/dist'){
 if(!value)throw new Error('API_ORIGIN obrigatório: origem HTTPS real da API Render, sem segredo');
 const origin=new URL(value);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||origin.hostname==='nexocenastudio.vercel.app')throw new Error('API_ORIGIN deve ser uma origem HTTPS do backend, sem caminho ou credenciais');
 await mkdir(output,{recursive:true});await cp(source,`${output}/static`,{recursive:true});
 const config={version:3,routes:[{src:'/api(?:/(.*))?',dest:`${origin.origin}/api/$1`,headers:{'Cache-Control':'no-store'}},{handle:'filesystem'},{src:'/.*',dest:'/index.html'}]};
 await writeFile(`${output}/config.json`,JSON.stringify(config,null,2)+'\n');return config;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await prepareVercel(process.env.API_ORIGIN);
