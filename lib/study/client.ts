// Same-origin only: no fallback that might send researcher credentials elsewhere.
export async function studyApi(path:string,data?:unknown){
 let r:Response;
 try{r=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),credentials:'same-origin'});}
 catch{throw Error('无法连接当前页面的问卷接口。若地址是 127.0.0.1，请使用运行中的问卷服务或 ESA 测试链接；线上地址请检查 HTTPS。');}
 let value:any;try{value=await r.json();}catch{throw Error('问卷接口返回了非 JSON 内容，请检查当前网址与 ESA API 路由。');}
 if(!r.ok)throw Error(value.error||'请求失败，请重试');return value;
}
