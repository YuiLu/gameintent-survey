// COS XML API signature, per Tencent's Request Signature specification.
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%'+c.charCodeAt(0).toString(16).toUpperCase());
const hex = b => [...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join('');
const bytes = s => new TextEncoder().encode(s);
async function hmac(key, value) {
  const k=await crypto.subtle.importKey('raw',bytes(key),{name:'HMAC',hash:'SHA-1'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',k,bytes(value)));
}
export function cosConfig(env) {
  const keys=['COS_BUCKET','COS_REGION','COS_MEDIA_ORIGIN','COS_SECRET_ID','COS_SECRET_KEY'];
  if(!keys.some(k=>env[k])) return null;
  if(keys.some(k=>!env[k])) throw new Error('COS configuration incomplete');
  if(!/^[a-z0-9-]+-\d+$/.test(env.COS_BUCKET)||!/^ap-[a-z0-9-]+$/.test(env.COS_REGION)) throw new Error('Invalid COS bucket/region');
  const origin=new URL(env.COS_MEDIA_ORIGIN);
  if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password) throw new Error('COS media origin must be an HTTPS origin');
  if(origin.hostname.endsWith('.myqcloud.com')) throw new Error('Use the COS custom media domain for browser playback');
  return {bucket:env.COS_BUCKET,region:env.COS_REGION,origin:origin.origin,id:env.COS_SECRET_ID,key:env.COS_SECRET_KEY,prefix:'study-v2/videos/'};
}
export async function signedCosUrl(config, objectKey, method='GET', time=Math.floor(Date.now()/1000), api=false) {
  if(!/^study-v2\/videos\/[a-zA-Z0-9_-]+\.mp4$/.test(objectKey)) throw new Error('Invalid media object key');
  if(!['GET','HEAD'].includes(method)) throw new Error('Only read signatures are supported');
  const origin=api?`https://${config.bucket}.cos.${config.region}.myqcloud.com`:config.origin;
  const url=new URL('/'+objectKey.split('/').map(enc).join('/'),origin);
  const period=`${time-60};${time+7200}`;
  const httpString=`${method.toLowerCase()}\n/${objectKey}\n\nhost=${enc(url.host)}\n`;
  const digest=hex(await crypto.subtle.digest('SHA-1',bytes(httpString)));
  const signature=await hmac(await hmac(config.key,period),`sha1\n${period}\n${digest}\n`);
  const params={'q-sign-algorithm':'sha1','q-ak':config.id,'q-sign-time':period,'q-key-time':period,'q-header-list':'host','q-url-param-list':'','q-signature':signature};
  url.search=new URLSearchParams(params).toString();
  return url.href;
}
