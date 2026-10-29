import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,copyFile,writeFile,readFile,unlink} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
async function sha256(path:string){const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);return h.digest('hex');}
export async function backupData(source:string,target:string){
 const root=resolve(source),out=resolve(target);if(out===root||out.startsWith(root+sep)||root.startsWith(out+sep))throw new Error('Backup deve ficar fora do diretório de dados');
 await mkdir(out,{mode:0o700});await writeFile(join(out,'INCOMPLETE'),'Backup em andamento',{mode:0o600});
 const db=new DatabaseSync(join(root,'studio.sqlite'),{readOnly:true});try{await backup(db,join(out,'studio.sqlite'));}finally{db.close();}
 const snapshot=new DatabaseSync(join(out,'studio.sqlite'),{readOnly:true});let ids:string[];try{ids=snapshot.prepare('SELECT id FROM media').all().map(x=>String(x.id));}finally{snapshot.close();}
 await mkdir(join(out,'media'),{mode:0o700});const hashes:Record<string,string>={'studio.sqlite':await sha256(join(out,'studio.sqlite'))};
 for(const id of ids){if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('ID de mídia inválido');const relative=`media/${id}`;await copyFile(join(root,relative),join(out,relative));hashes[relative]=await sha256(join(out,relative));}
 await writeFile(join(out,'manifest.json'),JSON.stringify({version:1,createdAt:new Date().toISOString(),files:hashes},null,2),{mode:0o600});await unlink(join(out,'INCOMPLETE'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.env.NODE_ENV==='production'||process.env.DATABASE_URL)throw new Error('Backup SQLite somente local; use pg_dump e exportação Storage para Supabase');if(!process.env.DATA_DIR||!process.env.BACKUP_DIR)throw new Error('Defina DATA_DIR e BACKUP_DIR (destino novo)');await backupData(process.env.DATA_DIR,process.env.BACKUP_DIR);console.log('Backup concluído. Proteja e criptografe o destino antes de transferir.');}
