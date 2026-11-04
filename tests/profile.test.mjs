import{test}from'node:test';import assert from'node:assert/strict';import{decodeProfile}from'../lib/study/profile.mjs';
test('recovers the production object-plus-encoded-JSON profile without losing familiarity or protocol',()=>{
 const raw=JSON.stringify([{games:['pubg','cs'],protocol:'blind-v1',blind_clean:true,similarity:{pairs:[{key:'cs|pubg'}]}},JSON.stringify({onboarding:'direct-v1'}),JSON.stringify({protocol:'blind-v1',blind_clean:false})]);
 const p=decodeProfile(raw);assert.deepEqual(p.games,['pubg','cs']);assert.equal(p.protocol,'blind-v1');assert.equal(p.onboarding,'direct-v1');assert.equal(p.blind_clean,false);assert.equal(p.similarity.pairs.length,1);assert.deepEqual(decodeProfile(JSON.stringify(p)),p);
});
