// Offline provisioning. Password is read only from stdin, never argv or logs.
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,scryptSync} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {credentialsSchema} from '../packages/core/src/schema.js';
if(!process.env.DATA_DIR||!process.env.PRIVATE_OWNER_EMAIL)throw new Error('Defina DATA_DIR absoluto e PRIVATE_OWNER_EMAIL');
const directory=resolve(process.env.DATA_DIR);if(directory!==process.env.DATA_DIR)throw new Error('DATA_DIR deve ser absoluto');
let password='';for await(const chunk of process.stdin){password+=chunk.toString();if(password.length>256)throw new Error('Senha muito longa');}
const input=credentialsSchema.parse({email:process.env.PRIVATE_OWNER_EMAIL,password:password.replace(/\r?\n$/,'')});
mkdirSync(directory,{recursive:true,mode:0o700});const db=new DatabaseSync(join(directory,'studio.sqlite'));
try{db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL)');
const email=input.email.toLowerCase();if(db.prepare('SELECT id FROM users WHERE email=?').get(email))throw new Error('Conta já existe; não foi sobrescrita');
const salt=randomBytes(16).toString('hex');db.prepare('INSERT INTO users VALUES(?,?,?)').run(randomUUID(),email,`${salt}:${scryptSync(input.password,salt,64).toString('hex')}`);console.log('Conta criada. Nenhuma conta existente foi alterada.');}finally{db.close();password='';}
