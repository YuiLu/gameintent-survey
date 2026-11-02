import {rootCertificates} from 'node:tls';
import {officialSupabaseCa} from './supabase-ca.mjs';

export function databaseTls(connectionString,customCa){
  const url=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw Object.assign(new Error('Invalid connection string URL'),{code:'ERR_INVALID_URL'});
  const supabase=/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)||/^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname);
  const ca=customCa?customCa.replace(/\\n/g,'\n'):supabase?[...rootCertificates,officialSupabaseCa]:undefined;
  return {rejectUnauthorized:true,...ca?{ca}:{}};
}
