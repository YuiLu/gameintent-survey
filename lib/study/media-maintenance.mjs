// Scoped upload authorization, never embedded in browser assets. Disabled by default.
export async function maintenanceToken(secret){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('survey-media-maintenance-v1'))),v=>v.toString(16).padStart(2,'0')).join('');
}
export async function mediaMaintenanceAllowed(request,env){
 if(env.STUDY_MEDIA_SETUP!=='1'||!env.STUDY_GATEWAY_KEY)return false;
 const actual=request.headers.get('authorization')||'',expected='Bearer '+await maintenanceToken(env.STUDY_GATEWAY_KEY);
 if(actual.length!==expected.length)return false;let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);return diff===0;
}
