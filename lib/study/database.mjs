import {assignSimilarity,validateSimilarity,SIMILARITY_VERSION} from './game-similarity.mjs';
import {MIN_COMPLETED_TO_FINISH} from './completion-policy.mjs';
import postgres from 'postgres';
import process from 'node:process';
import {databaseTls} from './database-tls.mjs';

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
    async updateFamiliarity(id,changes){return driver.transaction(async query=>{const [p]=await query('SELECT * FROM survey.participants WHERE id=$1 FOR UPDATE',[id]);if(!p||!['training','active'].includes(p.status))return false;const profile=JSON.parse(p.profile);const changed=JSON.stringify(profile.similarity_games||profile.games)!==JSON.stringify(changes.similarity_games);Object.assign(profile,changes);if(changed&&!profile.similarity?.submitted_at)delete profile.similarity;await query('UPDATE survey.participants SET profile=$1 WHERE id=$2',[JSON.stringify(profile),id]);return true;})},
    async similarityState(participantId,studyId,time,phase,answers=null,finalize=true){return driver.transaction(async query=>{
      await query('SELECT id FROM survey.studies WHERE id=$1 FOR UPDATE',[studyId]);
      const [p]=await query('SELECT * FROM survey.participants WHERE id=$1 FOR UPDATE',[participantId]);
      if(!p||!['training','active'].includes(p.status)||!p.consented_at)throw Error('Participant inactive');
      const profile=JSON.parse(p.profile);
      if(!profile.similarity){const others=await query("SELECT profile FROM survey.participants WHERE status IN ('training','active','completed')",[]),counts={};for(const row of others){for(const pair of JSON.parse(row.profile).similarity?.pairs||[])counts[pair.key]=(counts[pair.key]||0)+1;}
        profile.similarity={version:SIMILARITY_VERSION,phase,assigned_at:time,policy:'two-mechanism-overlap-plus-one-coverage-v1',pairs:assignSimilarity(profile.similarity_games||profile.games||[p.game],p.id,counts)};
      }
      if(answers!==null&&!profile.similarity.submitted_at){const validated=validateSimilarity(profile.similarity.pairs,answers);if(finalize){profile.similarity.responses=validated;profile.similarity.submitted_at=time;delete profile.similarity.draft_responses;}else profile.similarity.draft_responses=validated;}
      await query('UPDATE survey.participants SET profile=$1 WHERE id=$2',[JSON.stringify(profile),participantId]);return profile.similarity;
    })},
    async batch(statements){return driver.transaction(async query=>{const results=[];for(const s of statements)results.push({results:normalize(await query(s.text,s.values))});return results})},
    async lockBlind(id,participantId,payload,time){return driver.transaction(async query=>{
      const [p]=await query('SELECT status FROM survey.participants WHERE id=$1 FOR UPDATE',[participantId]);if(!p||!['training','active'].includes(p.status))throw Error('Participant inactive');
      const [d]=await query('SELECT payload FROM survey.drafts WHERE assignment_id=$1 AND participant_id=$2',[id,participantId]);const previous=d?JSON.parse(d.payload):{};
      if(previous._blind){if(JSON.stringify({...previous._blind,locked_at:undefined})!==JSON.stringify({...payload,locked_at:undefined}))return null;return previous._blind;}
      await query('INSERT INTO survey.drafts(assignment_id,participant_id,payload,updated_at) VALUES($1,$2,$3,$4) ON CONFLICT(assignment_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',[id,participantId,JSON.stringify({...previous,_blind:payload}),time]);return payload;
    })},
    async finishParticipant(participantId,studyId,time){return driver.transaction(async query=>{
      await query('SELECT id FROM survey.studies WHERE id=$1 FOR UPDATE',[studyId]);
      const [p]=await query('SELECT * FROM survey.participants WHERE id=$1 FOR UPDATE',[participantId]);
      if(p?.status==='completed')return true;
      if(p?.status!=='active')return false;
      const [count]=await query('SELECT COUNT(*) AS n FROM survey.responses WHERE participant_id=$1',[participantId]);
      if(Number(count.n)<MIN_COMPLETED_TO_FINISH)return false;
      await query('DELETE FROM survey.drafts WHERE participant_id=$1',[participantId]);
      await query('DELETE FROM survey.assignments a WHERE a.panel_id=$1 AND NOT EXISTS(SELECT 1 FROM survey.responses r WHERE r.assignment_id=a.id)',[p.panel_id]);
      await query("UPDATE survey.participants SET status='completed',completed_at=$1 WHERE id=$2",[time,participantId]);return true;
    })},
    async flexiblePanel(participantId,studyId,time,extend=false){return driver.transaction(async query=>{
      // Serialize reservations across all selected games, including simultaneous tabs.
      await query('SELECT id FROM survey.studies WHERE id=$1 FOR UPDATE',[studyId]);
      const [p]=await query('SELECT * FROM survey.participants WHERE id=$1 FOR UPDATE',[participantId]);
      if(!p||(!extend&&p.panel_id)|| (extend&&p.status!=='active'))return 0;
      const profile=JSON.parse(p.profile),games=profile.games||[p.game];
      if(extend){const pending=await query('SELECT a.id FROM survey.assignments a LEFT JOIN survey.responses r ON r.assignment_id=a.id WHERE a.panel_id=$1 AND r.assignment_id IS NULL',[p.panel_id]);if(pending.length)return 0;}
      const candidates=await query(`SELECT q.id,q.game,q.kind,
        (SELECT COUNT(*) FROM survey.assignments a JOIN survey.participants owner ON owner.panel_id=a.panel_id
         WHERE a.question_id=q.id AND a.trial_type='main' AND owner.status IN ('active','completed')) AS reserved
        FROM survey.questions q WHERE q.study_id=$1 AND q.game=ANY($2::text[]) AND (COALESCE((q.payload::jsonb->>'media_verified')::boolean,false) OR EXISTS(SELECT 1 FROM survey.media_assets m WHERE m.question_id=q.id))
        AND NOT EXISTS(SELECT 1 FROM survey.assignments mine WHERE mine.panel_id=$3 AND mine.question_id=q.id)
        ORDER BY md5(q.id || $4)`,[studyId,games,p.panel_id||'',p.id]);
      const eligible=candidates.map((q,priority)=>({...q,priority})).filter(q=>q.kind==='main'&&Number(q.reserved)<5),selected=[],counts={};
      while(selected.length<10&&eligible.length){eligible.sort((a,b)=>(counts[a.game]||0)-(counts[b.game]||0)||Number(a.reserved)-Number(b.reserved)||a.priority-b.priority);const q=eligible.shift();selected.push(q);counts[q.game]=(counts[q.game]||0)+1;}
      if(!selected.length||(!extend&&selected.length<7))return 0;
      let panel=p.panel_id,offset=0;
      if(!panel){panel=crypto.randomUUID();const [last]=await query("SELECT COALESCE(MAX(slot),-1) AS n FROM survey.panels WHERE study_id=$1 AND game='mixed'",[studyId]);await query("INSERT INTO survey.panels(id,study_id,game,slot,created_at) VALUES($1,$2,'mixed',$3,$4)",[panel,studyId,Number(last.n)+1,time]);}
      else{const [last]=await query('SELECT COALESCE(MAX(ordinal),-1) AS n FROM survey.assignments WHERE panel_id=$1',[panel]);offset=Number(last.n)+1;}
      const sequence=selected.map(q=>({id:crypto.randomUUID(),q:q.id,type:'main',repeat:null}));
      if(!extend){const controls=await query("SELECT id,kind FROM survey.questions WHERE study_id=$1 AND game=$2 AND kind IN ('control_positive','control_negative') ORDER BY id",[studyId,p.game]);const original=sequence[0];for(const [kind,index] of [['control_positive',1],['control_negative',4]]){const q=controls.find(q=>q.kind===kind);if(q)sequence.splice(index,0,{id:crypto.randomUUID(),q:q.id,type:kind,repeat:null});}sequence.splice(Math.min(7,sequence.length),0,{id:crypto.randomUUID(),q:original.q,type:'repeat',repeat:original.id});}
      for(let i=0;i<sequence.length;i++){const a=sequence[i];await query('INSERT INTO survey.assignments(id,panel_id,question_id,ordinal,trial_type,repeat_of) VALUES($1,$2,$3,$4,$5,$6)',[a.id,panel,a.q,offset+i,a.type,a.repeat]);}
      await query("UPDATE survey.participants SET panel_id=$1,qualified_at=COALESCE(qualified_at,$2),status='active' WHERE id=$3",[panel,time,participantId]);return sequence.length;
    })},
    async claimPanel(participantId,studyId,game,time){return driver.transaction(async query=>{
      await query('SELECT id FROM survey.studies WHERE id=$1 FOR UPDATE',[studyId]);
      const [p]=await query('SELECT panel_id FROM survey.participants WHERE id=$1 FOR UPDATE',[participantId]);
      if(!p||p.panel_id)return;
      const [panel]=await query(`SELECT pl.id FROM survey.panels pl WHERE pl.study_id=$1 AND pl.game=$2
        AND NOT EXISTS(SELECT 1 FROM survey.participants used WHERE used.panel_id=pl.id)
        AND NOT EXISTS(SELECT 1 FROM survey.assignments planned WHERE planned.panel_id=pl.id AND planned.trial_type='main' AND (SELECT COUNT(*) FROM survey.assignments a JOIN survey.participants owner ON owner.panel_id=a.panel_id WHERE a.question_id=planned.question_id AND a.trial_type='main' AND owner.status IN ('active','completed'))>=5)
        ORDER BY pl.slot LIMIT 1 FOR UPDATE OF pl SKIP LOCKED`,[studyId,game]);
      if(panel)await query("UPDATE survey.participants SET panel_id=$1,qualified_at=$2,status='active' WHERE id=$3 AND panel_id IS NULL",[panel.id,time,participantId]);
    })}
  };
}
let instance;
// Supabase hosted functions expose read-only environment variables.
export const databaseUrl=(env=process.env)=>env.DATABASE_URL||env.SUPABASE_DB_URL;
export function useTestDatabase(db){if(process.env.NODE_ENV!=='test')throw new Error('Test database override disabled');instance=db;}
export function database(){
  if(instance)return instance;
  const connectionString=databaseUrl();
  if(!connectionString)throw new Error('DATABASE_URL is required');
  // Transaction pooler: no named prepared statements or pipelined queries.
  const sql=postgres(connectionString,{max:1,prepare:false,max_pipeline:1,
    ssl:databaseTls(connectionString,process.env.DATABASE_CA_CERT),
    connect_timeout:15,idle_timeout:20,onnotice:()=>{}});
  instance=createDatabase({query:(text,values)=>sql.unsafe(text,values),
    transaction:fn=>sql.begin(tx=>fn((text,values)=>tx.unsafe(text,values)))});
  return instance;
}
