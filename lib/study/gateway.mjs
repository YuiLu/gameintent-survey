import {openMediaTicket} from './media-ticket.mjs';
import {secureStudyUrl} from './secure-url.mjs';
import {MEDIA_RELAY_HEADER, MEDIA_URL_HEADER, isMediaRequest, relayCosMedia} from './media-relay.mjs';
// The browser only calls /api on ESA. Supabase receives a signed server-to-server
// envelope; database credentials, admin cookies and COS keys stay off the client.
const encoder = new TextEncoder();
const MAX_BYTES = 4_000_000;
const allowedHeaders = ['cookie', 'authorization', 'content-type', 'origin', 'range'];
const envelopeHeaders = [...allowedHeaders, MEDIA_RELAY_HEADER];
const failure = (error, status) => Response.json({error}, {status, headers:{'Cache-Control':'no-store'}});

async function limitedText(request) {
  if (Number(request.headers.get('content-length')) > MAX_BYTES) throw new Error('large');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks=[]; let size=0;
  for (;;) {
    const {done,value}=await reader.read(); if(done)break;
    size+=value.length;
    if(size>MAX_BYTES){await reader.cancel();throw new Error('large');}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
async function key(secret, usage) {
  if(!/^[a-f0-9]{64,}$/i.test(secret||''))throw new Error('config');
  return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,[usage]);
}
const hex = bytes => Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const message = (time,body) => encoder.encode(time+'\n'+body);

export async function proxyStudyApi(request, env, send=fetch) {
  const secureUrl=secureStudyUrl(request.url);
  if(secureUrl)return new Response(null,{status:308,headers:{Location:secureUrl,'Cache-Control':'no-store'}});
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return failure('未找到页面',404);
  if(!['GET','POST'].includes(request.method))return failure('不支持的请求方法',405);
  const origin=request.headers.get('origin');
  if(origin&&origin!==url.origin)return failure('跨站请求已拒绝。',403);
  if (isMediaRequest(request)) {
    const ticket = await openMediaTicket(env.STUDY_GATEWAY_KEY, request);
    if (ticket) return relayCosMedia(request, ticket, send);
    // Expired tickets fall back to the ordinary permission check.
    url.searchParams.delete('play');
  }
  let upstream, authHeaders;
  try {
    upstream=new URL(env.STUDY_API_URL);
    if(upstream.protocol!=='https:'||!/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/survey-api$/.test(upstream.href))throw new Error();
    if(env.SUPABASE_PUBLISHABLE_KEY!==undefined){
      if(!/^sb_publishable_[\w-]{20,180}$/.test(env.SUPABASE_PUBLISHABLE_KEY))throw new Error();
      authHeaders={apikey:env.SUPABASE_PUBLISHABLE_KEY};
    }else{
      // Compatibility for existing Node deployments. ESA uses the shorter key
      // because its function variables are limited to 200 characters.
      if(!/^eyJ[\w-]*\.[\w-]+\.[\w-]+$/.test(env.SUPABASE_ANON_KEY||''))throw new Error();
      authHeaders={Authorization:'Bearer '+env.SUPABASE_ANON_KEY};
    }
    await key(env.STUDY_GATEWAY_KEY,'sign');
  } catch {return failure('问卷接口尚未配置完成。',503);}
  let content;
  try {content=await limitedText(request);}catch{return failure('请求内容过大或编码无效。',413);}
  const forwarded=Object.fromEntries(allowedHeaders.filter(h=>request.headers.has(h)).map(h=>[h,request.headers.get(h)]));
  if(isMediaRequest(request))forwarded[MEDIA_RELAY_HEADER]='esa';
  const body=JSON.stringify({url:url.href,method:request.method,headers:forwarded,body:content});
  if(encoder.encode(body).length>MAX_BYTES)return failure('请求内容过大。',413);
  const time=String(Date.now());
  const signature=hex(await crypto.subtle.sign('HMAC',await key(env.STUDY_GATEWAY_KEY,'sign'),message(time,body)));
  try {
    const response=await send(upstream.href,{method:'POST',headers:{
      'Content-Type':'application/json',...authHeaders,
      'x-study-time':time,'x-study-signature':signature
    },body,redirect:'manual',signal:AbortSignal.timeout(isMediaRequest(request)?15000:110000)});
    if(isMediaRequest(request) && response.status===204 && response.headers.has(MEDIA_URL_HEADER)){
      const ticket=response.headers.get(MEDIA_URL_HEADER);
      await response.body?.cancel();
      return relayCosMedia(request,ticket,send);
    }
    // Do not cache authenticated data or signed media redirects at the edge.
    const headers=new Headers(response.headers);headers.delete(MEDIA_URL_HEADER);headers.set('Cache-Control','no-store');
    return new Response(response.body,{status:response.status,headers});
  } catch {return failure('暂时无法连接问卷服务，请重试。',503);}
}

export async function receiveStudyApi(request, secret, route) {
  if(request.method!=='POST')return failure('未授权的接口请求。',401);
  const time=request.headers.get('x-study-time')||'',signature=request.headers.get('x-study-signature')||'';
  if(!/^\d{13}$/.test(time)||Math.abs(Date.now()-Number(time))>60000||!/^[a-f0-9]{64}$/.test(signature))return failure('未授权的接口请求。',401);
  let body;
  try{body=await limitedText(request);}catch{return failure('请求内容过大或编码无效。',413);}
  try{
    const bytes=Uint8Array.from(signature.match(/../g),v=>parseInt(v,16));
    if(!await crypto.subtle.verify('HMAC',await key(secret,'verify'),bytes,message(time,body)))return failure('未授权的接口请求。',401);
  }catch{return failure('问卷接口尚未配置完成。',503);}
  try{
    const envelope=JSON.parse(body),url=new URL(envelope.url);
    const local=url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
    if((url.protocol!=='https:'&&!local)||url.username||url.password||!url.pathname.startsWith('/api/')||!['GET','POST'].includes(envelope.method)||typeof envelope.body!=='string')throw new Error();
    if(!envelope.headers||Object.keys(envelope.headers).some(h=>!envelopeHeaders.includes(h)||typeof envelope.headers[h]!=='string'))throw new Error();
    const original=new Request(url.href,{method:envelope.method,headers:envelope.headers,...envelope.method==='POST'?{body:envelope.body}:{}});
    return route(original);
  }catch{return failure('请求格式无效。',400);}
}
