// Isolated PostgreSQL engine and HTTP API; no Supabase project is contacted.
import {PGlite} from '@electric-sql/pglite';
import {createDatabase,useTestDatabase} from '../lib/study/database.mjs';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {proxyStudyApi,receiveStudyApi} from '../lib/study/gateway.mjs';
import {DEFAULT_CONFIG,STUDY_ID} from '../lib/study/constants';
import assert from 'node:assert/strict';
Object.assign(process.env,{NODE_ENV:'test'});
process.env.DATABASE_URL='test-only-not-a-connection';
process.env.STUDY_ADMIN_KEY='fixture-admin-private-secret';
delete process.env.STUDY_INITIAL_POOL;
for(const key of Object.keys(process.env))if(key.startsWith('COS_'))delete process.env[key];
const pg=new PGlite();await pg.exec(readFileSync('supabase/001_schema.sql','utf8'));
useTestDatabase(createDatabase({query:async(s:any,v:any)=>(await pg.query(s,v)).rows,
  transaction:(fn:any)=>pg.transaction(tx=>fn(async(s:any,v:any)=>(await tx.query(s,v)).rows))}));
const {route}=await import('../lib/study/server');
// A pristine draft can change workload; frozen/allocated protocols must survive.
const oldConfig={...DEFAULT_CONFIG,version:'2.0',mainPerParticipant:25,participantsPerGame:8,contact:'preserved@example.invalid'};
await pg.query('INSERT INTO survey.studies (id,status,config,created_at) VALUES ($1,$2,$3,$4)',[STUDY_ID,'draft',JSON.stringify(oldConfig),new Date().toISOString()]);
const configRequest=()=>route(new Request('http://127.0.0.1:5180/api/config')).then(r=>r.json());
const upgraded=await configRequest();assert.equal(upgraded.config.mainPerParticipant,10);assert.equal(upgraded.config.participantsPerGame,20);assert.equal(upgraded.config.contact,oldConfig.contact);
await pg.query('UPDATE survey.studies SET config=$1,frozen_at=$2 WHERE id=$3',[JSON.stringify(oldConfig),new Date().toISOString(),STUDY_ID]);
assert.equal((await configRequest()).config.participantsPerGame,8);
await pg.query('UPDATE survey.studies SET frozen_at=NULL WHERE id=$1',[STUDY_ID]);
await pg.query('INSERT INTO survey.panels (id,study_id,game,slot,created_at) VALUES ($1,$2,$3,$4,$5)',['TEST_EXISTING_PANEL',STUDY_ID,'cs',0,new Date().toISOString()]);
assert.equal((await configRequest()).config.participantsPerGame,8);
await pg.query('DELETE FROM survey.panels WHERE id=$1',['TEST_EXISTING_PANEL']);
assert.equal((await configRequest()).config.participantsPerGame,20);
const gatewayEnv={STUDY_API_URL:'https://fixture.supabase.co/functions/v1/survey-api',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_'+ 'fixture'.repeat(5),STUDY_GATEWAY_KEY:'a'.repeat(64)};
const handler=process.env.STUDY_TEST_GATEWAY==='1'
  ? (request:Request)=>proxyStudyApi(request,gatewayEnv,async(url:any,init:any)=>receiveStudyApi(new Request(url,init),gatewayEnv.STUDY_GATEWAY_KEY,route))
  : route;
const server=createServer(async(req,res)=>{
  try{const chunks=[];for await(const b of req)chunks.push(b);
    const body=Buffer.concat(chunks);const request=new Request('http://127.0.0.1:5180'+req.url,{method:req.method,headers:req.headers as any,...body.length?{body}: {}});
    const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Test harness failed');}
});
await new Promise<void>(resolve=>server.listen(5180,'127.0.0.1',resolve));
try{const code=await new Promise(resolve=>{const child=spawn(process.execPath,['tests/full-flow.mjs'],{stdio:'inherit'});child.on('exit',resolve)});if(code!==0)process.exitCode=1;const late=await pg.query<{n:number}>("SELECT COUNT(*) AS n FROM survey.drafts d JOIN survey.participants p ON p.id=d.participant_id WHERE p.status='withdrawn'");assert.equal(Number(late.rows[0].n),0,'Withdrawn participants must have no surviving drafts');}
finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await pg.close();}
