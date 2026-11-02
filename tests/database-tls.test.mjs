import test from 'node:test';
import assert from 'node:assert/strict';
import {X509Certificate} from 'node:crypto';
import {databaseTls} from '../lib/study/database-tls.mjs';
import {officialSupabaseCa} from '../lib/study/supabase-ca.mjs';

test('official public Supabase CA is valid and limited to Supabase database hosts',()=>{
  const ca=new X509Certificate(officialSupabaseCa);
  assert.equal(ca.ca,true);assert.ok(ca.subject.includes('Supabase Root 2021 CA'));assert.ok(ca.verify(ca.publicKey));
  assert.ok(Date.now()<Date.parse(ca.validTo));
  for(const host of ['aws-0-ap-northeast-1.pooler.supabase.com','db.mtcfejthbrpgfqbtvuws.supabase.co']){
    const options=databaseTls('postgresql://user:password@'+host+':6543/postgres');
    assert.equal(options.rejectUnauthorized,true);assert.ok(options.ca.includes(officialSupabaseCa));
  }
  for(const host of ['database.example.com','db.fake.supabase.co.attacker.com']){
    const options=databaseTls('postgresql://user:password@'+host+'/postgres');
    assert.equal(options.rejectUnauthorized,true);assert.equal(options.ca,undefined);
  }
  assert.throws(()=>databaseTls('https://example.com'));
});
