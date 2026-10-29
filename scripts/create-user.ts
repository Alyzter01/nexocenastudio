// Offline provisioning/reset. Password is stdin only; no secret is logged.
import {randomBytes,randomUUID,scryptSync} from 'node:crypto';
import {resolve} from 'node:path';
import {credentialsSchema} from '../packages/core/src/schema.js';
import {openDatabase} from '../apps/api/src/database.js';
if(!process.env.PRIVATE_OWNER_EMAIL)throw new Error('PRIVATE_OWNER_EMAIL obrigatório');
if(!process.env.DATABASE_URL&&(!process.env.DATA_DIR||resolve(process.env.DATA_DIR)!==process.env.DATA_DIR))throw new Error('Defina DATABASE_URL; DATA_DIR absoluto somente em desenvolvimento');
let password='';for await(const chunk of process.stdin){password+=chunk.toString();if(password.length>256)throw new Error('Senha muito longa');}
const input=credentialsSchema.parse({email:process.env.PRIVATE_OWNER_EMAIL,password:password.replace(/\r?\n$/,'')});const reset=process.argv.includes('--reset');
const db=await openDatabase(process.env.DATA_DIR||'.data',process.env);
try{await db.transaction(async tx=>{await tx.lock('owner-provision');const email=input.email.toLowerCase();const existing=await tx.one('SELECT id FROM users WHERE email=?',email);if(existing&&!reset)throw new Error('Conta já existe; não foi sobrescrita. Reset exige --reset explícito');if(!existing&&reset)throw new Error('Conta não encontrada');const salt=randomBytes(16).toString('hex');const hashed=`${salt}:${scryptSync(input.password,salt,64).toString('hex')}`;if(existing){await tx.run('UPDATE users SET password=? WHERE id=?',hashed,existing.id);await tx.run('DELETE FROM sessions WHERE user_id=?',existing.id);}else await tx.run('INSERT INTO users(id,email,password) VALUES(?,?,?)',randomUUID(),email,hashed);});console.log(reset?'Senha redefinida e sessões revogadas. Dados preservados.':'Conta criada sem alterar contas existentes.');}finally{await db.close();password='';}
