import {route} from '../../../lib/study/server.ts';
import process from 'node:process';
import {receiveStudyApi} from '../../../lib/study/gateway.mjs';
// The platform checks the project credential before the private HMAC check.
Deno.serve(request=>receiveStudyApi(request,process.env.STUDY_GATEWAY_KEY,route));
