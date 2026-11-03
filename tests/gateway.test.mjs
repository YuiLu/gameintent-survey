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
  for(const invalid of [{},{...env,STUDY_API_URL:'https://evil.example'},{...env,STUDY_GATEWAY_KEY:'weak'},{...env,SUPABASE_PUBLISHABLE_KEY:'sb_secret_must_never_be_used'}])assert.equal((await proxyStudyApi(new Request(publicUrl),invalid,unexpected)).status,503);
  assert.equal((await proxyStudyApi(new Request(publicUrl,{method:'POST',body:'x'.repeat(4000001)}),env,unexpected)).status,413);
});

test('ESA short publishable key uses apikey and retains the signed gateway check',async()=>{
  const shortEnv={...env,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_'+'fixture'.repeat(5)};
  assert.ok(shortEnv.SUPABASE_PUBLISHABLE_KEY.length<=200);
  const response=await proxyStudyApi(new Request(publicUrl),shortEnv,async(url,init)=>{
    assert.equal(init.headers.apikey,shortEnv.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(init.headers.Authorization,undefined);
    return receiveStudyApi(new Request(url,init),shortEnv.STUDY_GATEWAY_KEY,()=>Response.json({ok:true}));
  });
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
});

test('authorized media streams COS bytes at ESA and never forwards browser credentials or the ticket', async () => {
  const {MEDIA_URL_HEADER,MEDIA_RELAY_HEADER} = await import('../lib/study/media-relay.mjs');
  const target='https://study-1250000000.cos.ap-shanghai.myqcloud.com/study-v2/videos/test_clip.mp4?q-sign-algorithm=sha1&q-signature=fixture';
  let authCalls=0,mediaCalls=0;
  const r=await proxyStudyApi(new Request('https://survey.example/api/media/test_clip',{headers:{Cookie:'gi_participant=private',Range:'bytes=0-3',[MEDIA_RELAY_HEADER]:'forged'}}),env,async(url,init)=>{
    if(url===env.STUDY_API_URL){
      authCalls++;
      return receiveStudyApi(new Request(url,init),env.STUDY_GATEWAY_KEY,async original=>{
        assert.equal(original.headers.get(MEDIA_RELAY_HEADER),'esa');
        assert.equal(original.headers.get('cookie'),'gi_participant=private');
        return new Response(null,{status:204,headers:{[MEDIA_URL_HEADER]:target}});
      });
    }
    mediaCalls++;assert.equal(url,target);assert.deepEqual(init.headers,{Range:'bytes=0-3'});assert.equal(init.redirect,'error');
    return new Response(new Uint8Array([0,1,2,3]),{status:206,headers:{'Content-Range':'bytes 0-3/10','Content-Length':'4','Accept-Ranges':'bytes'}});
  });
  assert.equal(authCalls,1);assert.equal(mediaCalls,1);assert.equal(r.status,206);
  assert.equal(r.headers.get('content-range'),'bytes 0-3/10');assert.equal(r.headers.get(MEDIA_URL_HEADER),null);
  assert.equal(r.headers.get('cache-control'),'private, max-age=300');assert.equal(r.headers.get('vary'),'Cookie, Authorization');
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[0,1,2,3]);
});

test('media relay rejects untrusted targets, retries transient failures, and preserves unsatisfiable ranges',async()=>{
  const {relayCosMedia,MEDIA_URL_HEADER}=await import('../lib/study/media-relay.mjs');
  const request=new Request('https://survey.example/api/media/test_clip',{headers:{Range:'bytes=999-'}});
  const target='https://study-1250000000.cos.ap-shanghai.myqcloud.com/study-v2/videos/test_clip.mp4?q-sign-algorithm=sha1&q-signature=fixture';
  for(const bad of ['https://evil.example/file',target.replace('test_clip.mp4','another.mp4'),target.replace('https:','http:')]){
    assert.equal((await relayCosMedia(request,bad,()=>{throw Error('must not fetch')})).status,502);
  }
  let calls=0;
  const partial=await relayCosMedia(request,target,async()=>++calls===1?new Response(null,{status:503}):new Response(null,{status:416,headers:{'Content-Range':'bytes */10'}}));
  assert.equal(calls,2);assert.equal(partial.status,416);assert.equal(partial.headers.get('content-range'),'bytes */10');assert.equal(partial.headers.get('cache-control'),'no-store');
  const denied=await proxyStudyApi(request,env,async()=>Response.json({error:'denied'},{status:403}));assert.equal(denied.status,403);
  const other=await proxyStudyApi(new Request(publicUrl,{headers:{'x-study-media-relay':'esa'}}),env,async(url,init)=>{
    assert.equal(JSON.parse(init.body).headers['x-study-media-relay'],undefined);
    return new Response(null,{status:204,headers:{[MEDIA_URL_HEADER]:target}});
  });
  assert.equal(other.headers.get(MEDIA_URL_HEADER),null);
});
