import test from 'node:test';
import assert from 'node:assert/strict';
import {publicFailure} from '../lib/study/errors.mjs';
test('database failure classification includes nested causes but never exposes connection secrets',()=>{
 const secret='postgresql://admin:PRIVATE_PASSWORD@private.host:6543/postgres';
 for(const [code,category] of [['28P01','DB_AUTHENTICATION'],['SELF_SIGNED_CERT_IN_CHAIN','DB_TLS_CERTIFICATE'],['ENOTFOUND','DB_DNS'],['42P01','DB_SCHEMA']]){
  const e=new Error(secret,{cause:Object.assign(new Error(secret),{code})});
  const result=publicFailure(e);assert.equal(result.code,category);assert.ok(!JSON.stringify(result).includes(secret));assert.equal(result.status,503);
 }
 const fallback=publicFailure(new Error(secret));assert.equal(fallback.code,'SERVER_ERROR');assert.ok(!JSON.stringify(fallback).includes('PRIVATE_PASSWORD'));
});
