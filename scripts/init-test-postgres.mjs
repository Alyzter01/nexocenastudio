import pg from 'pg';
const url=new URL(process.env.TEST_DATABASE_URL||'');
if(process.env.NODE_ENV!=='test'||!['127.0.0.1','localhost'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw new Error('Somente PostgreSQL local descartável de testes');
const pool=new pg.Pool({connectionString:url.toString(),ssl:false});try{for(const role of ['anon','authenticated']){const found=await pool.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role]);if(!found.rowCount)await pool.query(`CREATE ROLE ${role}`)}}finally{await pool.end()}
