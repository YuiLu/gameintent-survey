import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proxyStudyApi,receiveStudyApi} from '../lib/study/gateway.mjs';
const env={STUDY_API_URL:'https://fixture.supabase.co/functions/v1/survey-api',SUPABASE_ANON_KEY:'eyJfixture.payload.signature',STUDY_GATEWAY_KEY:'a'.repeat(64)};
const publicUrl='https://survey.example/api/answers';

test('ESA preserves public origin, participant/admin auth, body, cookie and media redirect',async()=>{
  const request=new Request(publicUrl,{method:'POST',headers:{Origin:'https://survey.example',Cookie:'gi_participant=private',Authorization:'Bearer private-admin','Content-Type':'application/json','x-study-signature':'client-forgery'},body:'{"label_support":"yes"}'});
  let calls=0;
  const response=await proxyStudyApi(request,env,async(url,init)=>{
    assert.equal(url,env.STUDY_API_URL);assert.equal(init.headers.Authorization,'Bearer '+env.SUPABASE_ANON_KEY);
    return receiveStudyApi(new Request(url,init),env.STUDY_GATEWAY_KEY,async original=>{
      calls++;assert.equal(original.url,publicUrl);assert.equal(original.headers.get('cookie'),'gi_participant=private');
      assert.equal(original.headers.get('authorization'),'Bearer private-admin');assert.equal(original.headers.get('x-study-signature'),null);
      assert.equal(await original.text(),'{"label_support":"yes"}');
      return new Response(null,{status:302,headers:{'Set-Cookie':'gi_admin=session; Path=/; HttpOnly; Secure; SameSite=Lax',Location:'https://media.example/signed'}});
    });
  });
  assert.equal(calls,1);assert.equal(response.status,302);assert.match(response.headers.get('set-cookie'),/HttpOnly/);
  assert.equal(response.headers.get('location'),'https://media.example/signed');assert.equal(response.headers.get('cache-control'),'no-store');
});
test('rejects cross-site, unsigned, expired and tampered requests before reaching business logic',async()=>{
  assert.equal((await proxyStudyApi(new Request(publicUrl,{method:'POST',headers:{Origin:'https://evil.example'}}),env,()=>{throw Error('must not send')})).status,403);
  assert.equal((await receiveStudyApi(new Request(env.STUDY_API_URL),env.STUDY_GATEWAY_KEY,()=>{throw Error('must not route')})).status,401);
  let captured;
  await proxyStudyApi(new Request(publicUrl),env,async(url,init)=>{captured={url,init};return Response.json({ok:true});});
  const {url,init}=captured;
  assert.equal((await receiveStudyApi(new Request(url,{...init,body:init.body+' '}),env.STUDY_GATEWAY_KEY,()=>{throw Error('must not route')})).status,401);
  assert.equal((await receiveStudyApi(new Request(url,{...init,headers:{...init.headers,'x-study-time':String(Date.now()-120000)}}),env.STUDY_GATEWAY_KEY,()=>{throw Error('must not route')})).status,401);
});
test('fails closed for incomplete configuration, invalid upstream and oversized body',async()=>{
  const unexpected=()=>{throw Error('must not send');};
  for(const invalid of [{},{...env,STUDY_API_URL:'https://evil.example'},{...env,STUDY_GATEWAY_KEY:'weak'}])assert.equal((await proxyStudyApi(new Request(publicUrl),invalid,unexpected)).status,503);
  assert.equal((await proxyStudyApi(new Request(publicUrl,{method:'POST',body:'x'.repeat(4000001)}),env,unexpected)).status,413);
});
