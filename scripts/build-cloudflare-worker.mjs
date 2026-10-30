import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const out=resolve(root,'dist/worker/nexocena-api-experimental.mjs');
await mkdir(resolve(root,'dist/worker'),{recursive:true});
await build({
 entryPoints:[resolve(root,'apps/worker/src/index.ts')],
 outfile:out,
 bundle:true,
 platform:'browser',
 format:'esm',
 target:'es2022',
 conditions:['workerd','worker','browser','import','default'],
 minify:true,
 legalComments:'none',
 sourcemap:false,
 logLevel:'info'
});
const bytes=await readFile(out);
const digest=createHash('sha256').update(bytes).digest('hex');
await writeFile(out+'.sha256',digest+'  nexocena-api-experimental.mjs\n');
console.log('Worker artifact:',out,'bytes:',bytes.length,'sha256:',digest);
