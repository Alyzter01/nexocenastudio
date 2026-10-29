import {openDatabase} from '../apps/api/src/database.js';
import {createMediaStore} from '../apps/api/src/media-store.js';
const db=await openDatabase(process.env.DATA_DIR||'.data',process.env);const storage=await createMediaStore(process.env.DATA_DIR||'.data',process.env);
try{await db.transaction(async tx=>{await tx.lock('storage-cleanup');const candidates=await tx.all('SELECT id FROM storage_cleanup WHERE created_at<?',new Date(Date.now()-86400000).toISOString());for(const row of candidates){const id=String(row.id);if(!await tx.one('SELECT id FROM media WHERE id=?',id))await storage.remove(id);await tx.run('DELETE FROM storage_cleanup WHERE id=?',id);}console.log('Reconciliação de intenções antigas concluída.');});}finally{await db.close();}
