// Recover legacy JSONB concatenations that accidentally appended encoded JSON
// strings to an object. Preserve fields in write order, without touching answers.
/** @returns {Record<string, any>} */
export function decodeProfile(raw){
 const value=typeof raw==='string'?JSON.parse(raw):raw;
 const result={};
 function merge(v,depth=0){
  if(depth>12)throw Error('Profile nesting limit');
  if(Array.isArray(v)){for(const item of v)merge(item,depth+1);return;}
  if(typeof v==='string'){let parsed;try{parsed=JSON.parse(v);}catch{return;}if(parsed!==v)merge(parsed,depth+1);return;}
  if(v&&typeof v==='object')for(const [key,value]of Object.entries(v))if(!['__proto__','constructor','prototype'].includes(key))result[key]=value;
 }
 merge(value);return result;
}
