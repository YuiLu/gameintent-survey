// Public deployment diagnostics: never return raw errors, URLs, SQL or credentials.
export function publicFailure(error){
  const seen=new Set(),errors=[];
  function collect(e){if(!e||typeof e!=='object'||seen.has(e))return;seen.add(e);errors.push(e);collect(e.cause);if(Array.isArray(e.errors))e.errors.forEach(collect)}
  collect(error);
  const codes=errors.map(e=>e.code),matches=re=>errors.some(e=>typeof e.message==='string'&&re.test(e.message));
  if(matches(/COS configuration incomplete|Invalid COS bucket|COS media origin|Use the COS custom media domain/i))return {code:'COS_CONFIGURATION',error:'COS 视频配置不完整或格式不正确。请在 Supabase Secrets 核对 COS_BUCKET、COS_REGION、COS_MEDIA_ORIGIN、COS_SECRET_ID、COS_SECRET_KEY。',status:503};
  if(codes.some(c=>['SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED'].includes(c))||matches(/self.signed|certificate.*(?:verify|chain)/i))return {code:'DB_TLS_CERTIFICATE',error:'数据库 TLS 证书校验失败。请在服务端配置 Supabase 的根证书 DATABASE_CA_CERT。',status:503};
  if(codes.includes('28P01'))return {code:'DB_AUTHENTICATION',error:'数据库用户名或密码不正确。请核对 Transaction pooler 连接串及密码的 URL 编码。',status:503};
  if(matches(/tenant or user not found/i))return {code:'DB_POOLER_USER',error:'连接池的项目或用户名不匹配。请从 Supabase Connect 重新复制 Transaction pooler 连接串。',status:503};
  if(codes.includes('ENOTFOUND')||codes.includes('EAI_AGAIN'))return {code:'DB_DNS',error:'数据库主机名无法解析。请核对连接串中的主机名。',status:503};
  if(codes.some(c=>['CONNECT_TIMEOUT','CONNECTION_CLOSED','ETIMEDOUT','ECONNREFUSED','ECONNRESET'].includes(c)))return {code:'DB_CONNECTION',error:'暂时无法连接数据库，请检查项目是否运行及连接池地址。',status:503};
  if(codes.includes('42P01')||codes.includes('3F000'))return {code:'DB_SCHEMA',error:'数据库缺少问卷表，请在正确的 Supabase 项目运行建表脚本。',status:503};
  if(codes.includes('42501'))return {code:'DB_PERMISSION',error:'数据库连接身份没有访问问卷 schema 的权限。',status:503};
  if(codes.includes('ERR_INVALID_URL')||matches(/invalid (?:url|connection string)|invalid port/i))return {code:'DB_URL_FORMAT',error:'DATABASE_URL 格式不正确，应填写完整的 PostgreSQL Transaction pooler 连接串。',status:503};
  return {code:'SERVER_ERROR',error:'服务器暂时无法完成操作。回答不会被自动清除，请重试。',status:500};
}
