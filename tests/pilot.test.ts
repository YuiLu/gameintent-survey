import {test} from 'node:test';
import assert from 'node:assert/strict';
import pool from '../data/pool.json';
import {readiness} from '../lib/study/validation';
import {DEFAULT_CONFIG} from '../lib/study/constants';
import {studyApi} from '../lib/study/client';
test('pilot permits unreviewed candidate controls but never ignores missing media',()=>{
 const config={...DEFAULT_CONFIG,datasetRevision:'fixture',contact:''};
 const readyMedia=pool.map(q=>({...q,media_verified:true}));
 assert.equal(readiness(readyMedia as any,config,{pilot:true}).ready,true);
 assert.equal(readiness(readyMedia as any,config).ready,false);
 assert.equal(readiness(pool as any,config,{pilot:true}).ready,false);
});
test('failed network requests become actionable errors without changing destination',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async()=>{throw TypeError('Failed to fetch');};await assert.rejects(studyApi('admin/login',{key:'fixture'}),/无法连接当前页面/);
 globalThis.fetch=async()=>new Response('<html>wrong origin</html>',{status:502});await assert.rejects(studyApi('config'),/非 JSON/);
 }finally{globalThis.fetch=original;}
});
