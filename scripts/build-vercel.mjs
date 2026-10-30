/**
 * Exact-branch preview build only. Production retains the existing API_ORIGIN gate.
 * Never sends the browser demo to a backend or migrates any data.
 */
import {execFileSync} from 'node:child_process';
import {prepareVercel} from './prepare-vercel.mjs';

const previewBranch='experiment/cloudflare-pages-workers-d1';
const isPreview=process.env.VERCEL_GIT_COMMIT_REF===previewBranch;
const env={...process.env};
if(isPreview){
 env.VITE_NEXOCENA_EXPERIMENTAL='true';
 env.VITE_NEXOCENA_PREVIEW_DEMO='true';
 console.log('Building isolated, local-only NEXOCENA interface preview');
}else{
 // Production/other branches keep failing closed if API_ORIGIN is missing.
 if(!process.env.API_ORIGIN)throw Error('API_ORIGIN obrigatório para aplicação com backend');
}
execFileSync('npm',['run','build','-w','apps/web'],{env,stdio:'inherit'});
await prepareVercel(process.env.API_ORIGIN,'.vercel/output','apps/web/dist',isPreview);
