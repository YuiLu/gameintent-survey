import assert from 'node:assert/strict';
import process from 'node:process';
import {proxyStudyApi} from '../lib/study/gateway.mjs';
process.env.STUDY_GATEWAY_KEY='a'.repeat(64);
delete process.env.DATABASE_URL;
delete process.env.SUPABASE_DB_URL;
// Supabase's hosted Deno runtime forbids environment mutation. Reproduce that
// constraint before loading the actual deployable function bundle.
process.env=new Proxy({...process.env},{set(){throw new Error('Hosted environment is read-only');},deleteProperty(){throw new Error('Hosted environment is read-only');}});
let handler;
Deno.serve=fn=>{handler=fn;};
await import('../supabase/functions/survey-api/index.mjs');
assert.equal(typeof handler,'function');
const env={STUDY_API_URL:'https://fixture.supabase.co/functions/v1/survey-api',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_'+'fixture'.repeat(5),STUDY_GATEWAY_KEY:'a'.repeat(64)};
const invoke=(url,init)=>handler(new Request(url,init));
const health=await proxyStudyApi(new Request('https://survey.example/api/health'),env,invoke);
assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true,version:'3.1'});
assert.equal((await handler(new Request(env.STUDY_API_URL))).status,401);
assert.equal((await proxyStudyApi(new Request('https://survey.example/api/config'),env,invoke)).status,503);
console.log('PASS: actual Supabase bundle boots in Deno, health works through signed ESA proxy, unsigned calls rejected, missing database fails closed. No production data accessed.');
