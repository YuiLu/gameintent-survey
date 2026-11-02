import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { cosConfig, signedCosUrl } from '../lib/study/cos.mjs';

const env={COS_BUCKET:'study-1250000000',COS_REGION:'ap-shanghai',COS_MEDIA_ORIGIN:'https://gameintent-media.magic-lab.tech',COS_SECRET_ID:'test-id',COS_SECRET_KEY:'test-only-key'};
test('COS configuration is all-or-nothing; playback requires custom HTTPS origin',()=>{
  assert.equal(cosConfig({}),null);
  assert.throws(()=>cosConfig({COS_BUCKET:env.COS_BUCKET}));
  for(const origin of ['http://example.com','https://example.com/path','https://u:p@example.com','https://bucket.cos.ap-shanghai.myqcloud.com']) assert.throws(()=>cosConfig({...env,COS_MEDIA_ORIGIN:origin}));
});
test('GET signature matches independent Node HMAC calculation; HEAD is distinct',async()=>{
  const config=cosConfig(env),time=1800000000,key='study-v2/videos/dota_test.mp4';
  const url=new URL(await signedCosUrl(config,key,'GET',time));
  const period=`${time-60};${time+7200}`;
  const sha=createHash('sha1').update(`get\n/${key}\n\nhost=gameintent-media.magic-lab.tech\n`).digest('hex');
  const sk=createHmac('sha1',env.COS_SECRET_KEY).update(period).digest('hex');
  const expected=createHmac('sha1',sk).update(`sha1\n${period}\n${sha}\n`).digest('hex');
  assert.equal(url.searchParams.get('q-signature'),expected);
  assert.equal(url.searchParams.get('q-sign-time'),period);
  assert.ok(!url.href.includes(env.COS_SECRET_KEY));
  const head=new URL(await signedCosUrl(config,key,'HEAD',time,true));
  assert.equal(head.hostname,'study-1250000000.cos.ap-shanghai.myqcloud.com');
  assert.notEqual(head.searchParams.get('q-signature'),expected);
  await assert.rejects(signedCosUrl(config,'../elsewhere.mp4'));
  await assert.rejects(signedCosUrl(config,key,'PUT'));
});
