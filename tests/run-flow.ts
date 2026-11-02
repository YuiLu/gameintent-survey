// Isolated PostgreSQL engine and HTTP API; no Supabase project is contacted.
import {PGlite} from '@electric-sql/pglite';
import {createDatabase,useTestDatabase} from '../lib/study/database.mjs';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
Object.assign(process.env,{NODE_ENV:'test'});
process.env.DATABASE_URL='test-only-not-a-connection';
process.env.STUDY_ADMIN_KEY='fixture-admin-private-secret';
delete process.env.STUDY_INITIAL_POOL;
for(const key of Object.keys(process.env))if(key.startsWith('COS_'))delete process.env[key];
const pg=new PGlite();await pg.exec(readFileSync('supabase/001_schema.sql','utf8'));
useTestDatabase(createDatabase({query:async(s:any,v:any)=>(await pg.query(s,v)).rows,
  transaction:(fn:any)=>pg.transaction(tx=>fn(async(s:any,v:any)=>(await tx.query(s,v)).rows))}));
const {route}=await import('../lib/study/server');
const server=createServer(async(req,res)=>{
  try{const chunks=[];for await(const b of req)chunks.push(b);
    const body=Buffer.concat(chunks);const request=new Request('http://127.0.0.1:5180'+req.url,{method:req.method,headers:req.headers as any,...body.length?{body}: {}});
    const response=await route(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Test harness failed');}
});
await new Promise<void>(resolve=>server.listen(5180,'127.0.0.1',resolve));
try{const code=await new Promise(resolve=>{const child=spawn(process.execPath,['tests/full-flow.mjs'],{stdio:'inherit'});child.on('exit',resolve)});if(code!==0)process.exitCode=1;}
finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await pg.close();}
