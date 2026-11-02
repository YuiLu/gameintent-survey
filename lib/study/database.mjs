import postgres from 'postgres';

const tables='analysis_runs|assignments|audit_events|drafts|panels|participants|questions|responses|studies|media_assets';
export function compileSql(sql) {
  const ignore=/^INSERT OR IGNORE /i.test(sql);
  sql=sql.replace(/^INSERT OR IGNORE /i,'INSERT ');
  if(ignore) sql+=' ON CONFLICT DO NOTHING';
  sql=sql.replace(new RegExp(`\\b(FROM|JOIN|UPDATE|INTO)\\s+(${tables})\\b`,'gi'),'$1 survey.$2');
  // Replace parameter placeholders only outside SQL string literals.
  let quoted=false,n=0,out='';
  for(let i=0;i<sql.length;i++){
    if(sql[i]==="'") {out+=sql[i];if(quoted&&sql[i+1]==="'"){out+=sql[++i];continue}quoted=!quoted;}
    else out+=sql[i]==='?'&&!quoted?'$'+(++n):sql[i];
  }
  return out;
}
const normalize=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,['n','remaining','media_bytes'].includes(k)&&v!==null?Number(v):v])));
export function createDatabase(driver) {
  function statement(sql,values=[]) {
    const text=compileSql(sql);
    return {text,values,bind(...params){return statement(sql,params)},
      async all(){return {results:normalize(await driver.query(text,values))}},
      async first(){return normalize(await driver.query(text,values))[0]??null},
      async run(){await driver.query(text,values);return {success:true}}};
  }
  return {prepare:statement,
    async batch(statements){return driver.transaction(async query=>{const results=[];for(const s of statements)results.push({results:normalize(await query(s.text,s.values))});return results})},
    async claimPanel(participantId,studyId,game,time){return driver.transaction(async query=>{
      const [p]=await query('SELECT panel_id FROM survey.participants WHERE id=$1 FOR UPDATE',[participantId]);
      if(!p||p.panel_id)return;
      const [panel]=await query(`SELECT pl.id FROM survey.panels pl WHERE pl.study_id=$1 AND pl.game=$2
        AND NOT EXISTS(SELECT 1 FROM survey.participants used WHERE used.panel_id=pl.id)
        ORDER BY pl.slot LIMIT 1 FOR UPDATE OF pl SKIP LOCKED`,[studyId,game]);
      if(panel)await query("UPDATE survey.participants SET panel_id=$1,qualified_at=$2,status='active' WHERE id=$3 AND panel_id IS NULL",[panel.id,time,participantId]);
    })}
  };
}
let instance;
export function useTestDatabase(db){if(process.env.NODE_ENV!=='test')throw new Error('Test database override disabled');instance=db;}
export function database(){
  if(instance)return instance;
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
  // Transaction pooler: no named prepared statements or pipelined queries.
  const sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false,max_pipeline:1,
    ssl:{rejectUnauthorized:true,...process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT}:{}},
    connect_timeout:15,idle_timeout:20,onnotice:()=>{}});
  instance=createDatabase({query:(text,values)=>sql.unsafe(text,values),
    transaction:fn=>sql.begin(tx=>fn((text,values)=>tx.unsafe(text,values)))});
  return instance;
}
