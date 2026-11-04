// Upload via a scoped Supabase maintenance ticket. COS keys remain in Supabase.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {proxyStudyApi} from '../lib/study/gateway.mjs';
import {maintenanceToken} from '../lib/study/media-maintenance.mjs';
const env=Object.fromEntries((await fs.readFile('work/esa-runtime.env','utf8')).split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const authorization='Bearer '+await maintenanceToken(env.STUDY_GATEWAY_KEY);
async function api(path,body){const r=await proxyStudyApi(new Request('https://gameintent-survey.magic-lab.tech/api/maintenance/'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization},body:JSON.stringify(body)}),env);const j=await r.json();if(!r.ok)throw Error(`${path}: ${r.status} ${j.error||'request failed'}`);return j;}
const pool=JSON.parse(await fs.readFile('data/pool.json','utf8')),only=process.argv[2],rows=only==='--game'?pool.filter(q=>q.game===process.argv[3]):only?pool.filter(q=>q.id===only):pool;
if(!rows.length)throw Error('Unknown frozen question ID');
const done=[],failed=[];let cursor=0;
async function source(q){const host=['apex','overwatch'].includes(q.game)?'rtx7_35981':'a1_game',program='import pathlib,sys;sys.stdout.buffer.write(pathlib.Path('+JSON.stringify(q.provenance.native_video_path)+').read_bytes())';return new Promise((ok,fail)=>{const child=spawn('ssh',['-4','-o','BatchMode=yes','-o','ClearAllForwardings=yes','-o','ConnectTimeout=15',host,'python3','-'],{stdio:['pipe','pipe','pipe']});const chunks=[];let bytes=0;const timer=setTimeout(()=>child.kill(),180000);child.stdout.on('data',b=>{bytes+=b.length;if(bytes>q.provenance.video_bytes)child.kill();else chunks.push(b)});child.stderr.resume();child.on('error',fail);child.on('close',code=>{clearTimeout(timer);code===0?ok(Buffer.concat(chunks)):fail(Error('Source SSH failed'))});child.stdin.end(program);});}
async function one(q){const expected=q.video_sha256,size=q.provenance.video_bytes;
 // Resumable: an already verified object is registered without uploading again.
 try{await api('media-register',{assets:[{question_id:q.id,sha256:expected,bytes:size}]});return;}catch(e){if(!/COS 视频校验失败/.test(e.message))throw e;}
 const bytes=await source(q);if(bytes.length!==size||createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Source checksum mismatch');
 const md5=createHash('md5').update(bytes).digest('base64'),ticket=await api('media-ticket',{question_id:q.id,md5});const u=new URL(ticket.url),expectedHost='gameintent-survey-1321360347.cos.ap-shanghai.myqcloud.com';
 if(u.protocol!=='https:'||u.host!==expectedHost||u.pathname!==`/study-v2/videos/${q.id}.mp4`)throw Error('Unexpected upload destination');
 const put=await fetch(ticket.url,{method:'PUT',headers:ticket.headers,body:bytes,redirect:'error',signal:AbortSignal.timeout(180000)});if(!put.ok)throw Error('COS PUT status '+put.status);
 // Read the full uploaded object and verify SHA-256, without logging the signed URL.
 const checkUrl=new URL(ticket.verification_url);if(checkUrl.protocol!=='https:'||checkUrl.host!==expectedHost||checkUrl.pathname!==u.pathname)throw Error('Unexpected verification destination');
 const check=await fetch(checkUrl,{redirect:'error',signal:AbortSignal.timeout(180000)});if(!check.ok)throw Error('COS GET status '+check.status);const remote=Buffer.from(await check.arrayBuffer());if(remote.length!==size||createHash('sha256').update(remote).digest('hex')!==expected)throw Error('Remote checksum mismatch');
 await api('media-register',{assets:[{question_id:q.id,sha256:expected,bytes:size}]});
}
await Promise.all(Array.from({length:4},async()=>{while(cursor<rows.length){const q=rows[cursor++];let success=false;for(let attempt=0;attempt<3;attempt++){try{await one(q);success=true;break;}catch(e){console.log('Retry',q.id,attempt+1,String(e.message).replace(/https?:\/\/\S+/g,'[url omitted]'));}}(success?done:failed).push(q.id);console.log('Progress',done.length, '/',rows.length,'failed',failed.length);}}));
await fs.writeFile(only==='--game'?'work/cos-'+process.argv[3]+'-upload-receipt.json':'work/cos-gateway-upload-receipt.json',JSON.stringify({verified:done,failed,created_at:new Date().toISOString()},null,2),{mode:0o600});console.log(JSON.stringify({verified:done.length,failed:failed.length}));if(failed.length)process.exitCode=1;
