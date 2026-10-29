import {openDatabase,type Database} from '../apps/api/src/database.js';
import {createMediaStore,type MediaStore} from '../apps/api/src/media-store.js';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export async function reconcileStorage(db:Database,storage:MediaStore){return db.transaction(async tx=>{await tx.lock('storage-cleanup');const candidates=await tx.all('SELECT id FROM storage_cleanup WHERE created_at<? ORDER BY created_at LIMIT 100',new Date(Date.now()-86400000).toISOString());for(const row of candidates){const id=String(row.id);if(!await tx.one('SELECT id FROM media WHERE id=?',id))await storage.remove(id);await tx.run('DELETE FROM storage_cleanup WHERE id=?',id);}return candidates.length;});}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const db=await openDatabase(process.env.DATA_DIR||'.data',process.env);try{const storage=await createMediaStore(process.env.DATA_DIR||'.data',process.env);await reconcileStorage(db,storage);console.log('Reconciliação de intenções antigas concluída.');}finally{await db.close();}}
