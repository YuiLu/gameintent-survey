import {route} from '../../../lib/study/server.ts';
import process from 'node:process';
import {receiveStudyApi} from '../../../lib/study/gateway.mjs';
// Supabase supplies its own database URI to this server-side function. Keep an
// explicit DATABASE_URL override for the previously verified transaction pooler.
if(!process.env.DATABASE_URL&&process.env.SUPABASE_DB_URL)process.env.DATABASE_URL=process.env.SUPABASE_DB_URL;
// The platform checks the legacy JWT before this additional private HMAC check.
Deno.serve(request=>receiveStudyApi(request,process.env.STUDY_GATEWAY_KEY,route));
