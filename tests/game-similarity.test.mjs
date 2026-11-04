import{test}from'node:test';import assert from'node:assert/strict';
import{assignSimilarity,validateSimilarity,analyzeSimilarity,priorityKeys}from'../lib/study/game-similarity.mjs';
test('pairs use only familiar games, emphasize design priorities, and retain a coverage slot',()=>{
 const games=['pubg','naraka','apex','cs'];const pairs=assignSimilarity(games,'fixture');assert.deepEqual(assignSimilarity(games,'fixture'),pairs);assert.equal(pairs.length,3);assert.equal(new Set(pairs.map(p=>p.key)).size,3);assert.ok(pairs.every(p=>p.games.every(g=>games.includes(g))));assert.equal(pairs.filter(p=>priorityKeys.has(p.key)).length,2);assert.equal(assignSimilarity(['cs'],'fixture').length,0);assert.equal(assignSimilarity(['cs','valorant'],'fixture').length,1);
 const unpopular=Object.fromEntries(pairs.filter(p=>p.priority==='mechanism-overlap').map(p=>[p.key,100]));assert.ok(assignSimilarity(games,'fixture',unpopular).some(p=>p.priority==='mechanism-overlap'&&!unpopular[p.key]));
});
test('rating validation rejects foreign, duplicate and out-of-range pairs',()=>{
 const pairs=assignSimilarity(['cs','valorant'],'p');const a={key:pairs[0].key,status:'rated',score:4};assert.equal(validateSimilarity(pairs,[a])[0].score,4);assert.throws(()=>validateSimilarity(pairs,[{...a,score:6}]));assert.throws(()=>validateSimilarity(pairs,[{...a,key:'forged'}]));assert.throws(()=>validateSimilarity(pairs,[a,a]));assert.throws(()=>validateSimilarity(pairs,[{...a,status:'unable'}]));
});
test('formal-only similarity metrics retain missing categories and exclude withdrawn/pilot profiles',()=>{
 const p=(id,score,status='active',phase='live')=>({id,status,profile:{similarity:{phase,submitted_at:'now',responses:[{key:'a|b',games:['a','b'],status:score?'rated':'unable',score:score||null}]}}});
 const r=analyzeSimilarity([p('1',3),p('2',5),p('3',null),p('4',1,'withdrawn'),p('5',1,'active','pilot')],200);assert.equal(r.participants,3);assert.equal(r.pairs['a|b'].mean,4);assert.equal(r.pairs['a|b'].n,2);assert.equal(r.pairs['a|b'].unable,1);assert.equal(r.pairs['a|b'].score_100,75);
});
