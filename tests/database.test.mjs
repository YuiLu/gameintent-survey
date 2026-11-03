import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {compileSql,createDatabase,databaseUrl} from '../lib/study/database.mjs';

test('hosted database connection fallback never mutates read-only environment',()=>{
  const provided=Object.freeze({SUPABASE_DB_URL:'provider-fixture'});
  assert.equal(databaseUrl(provided),'provider-fixture');
  assert.equal(databaseUrl(Object.freeze({...provided,DATABASE_URL:'override-fixture'})),'override-fixture');
  assert.equal(databaseUrl(Object.freeze({})),undefined);
});

test('PostgreSQL preserves quoted question marks and upserts',()=>{
  assert.equal(compileSql("SELECT '?' FROM studies WHERE id=?"),"SELECT '?' FROM survey.studies WHERE id=$1");
  assert.match(compileSql('INSERT OR IGNORE INTO responses VALUES (?)'),/survey.responses VALUES \(\$1\) ON CONFLICT DO NOTHING$/);
});
test('initialization always qualifies table names instead of relying on session search_path',()=>{
  const sql=fs.readFileSync('supabase/001_schema.sql','utf8');
  const creates=[...sql.matchAll(/CREATE TABLE IF NOT EXISTS ([\w.]+)/g)].map(m=>m[1]);
  assert.equal(creates.length,10);
  assert.ok(creates.every(name=>name.startsWith('survey.')));
  assert.doesNotMatch(sql,/SET LOCAL search_path/);
  assert.equal([...sql.matchAll(/ALTER TABLE survey\.\w+ ENABLE ROW LEVEL SECURITY/g)].length,10);
});
test('real PostgreSQL schema, atomic batches, unique claims and immutable responses',async()=>{
  const pg=new PGlite();await pg.exec(fs.readFileSync('supabase/001_schema.sql','utf8'));
  const db=createDatabase({query:async(s,v)=>(await pg.query(s,v)).rows,
    transaction:fn=>pg.transaction(tx=>fn(async(s,v)=>(await tx.query(s,v)).rows))});
  const put=(s,...v)=>db.prepare(s).bind(...v);
  await put('INSERT INTO studies(id,status,config,created_at) VALUES (?,?,?,?)','s','draft','{}','now').run();
  assert.equal((await put('SELECT COUNT(*) AS n FROM studies').first()).n,1);
  // Reinitialization must preserve existing study configuration and answers.
  await pg.exec(fs.readFileSync('supabase/001_schema.sql','utf8'));
  assert.equal((await put('SELECT status FROM studies WHERE id=?','s').first()).status,'draft');
  await assert.rejects(db.batch([put('INSERT INTO studies(id,status,config,created_at) VALUES (?,?,?,?)','rollback','draft','{}','now'),put('INSERT INTO studies(id,status,config,created_at) VALUES (?,?,?,?)','s','draft','{}','now')]));
  assert.equal(await put('SELECT id FROM studies WHERE id=?','rollback').first(),null);
  await put('INSERT INTO panels(id,study_id,game,slot,created_at) VALUES (?,?,?,?,?)','panel','s','cs',0,'now').run();
  for(const id of ['p1','p2'])await put('INSERT INTO participants(id,game,resume_hash,profile,status,created_at) VALUES (?,?,?,?,?,?)',id,'cs',id,'{}','training','now').run();
  await Promise.all(['p1','p2'].map(id=>db.claimPanel(id,'s','cs','now')));
  assert.equal((await put('SELECT COUNT(*) AS n FROM participants WHERE panel_id IS NOT NULL').first()).n,1);
  await put('INSERT OR IGNORE INTO responses(assignment_id,participant_id,payload,digest,submitted_at) VALUES (?,?,?,?,?)','a','p1','original','hash','now').run();
  await put('INSERT OR IGNORE INTO responses(assignment_id,participant_id,payload,digest,submitted_at) VALUES (?,?,?,?,?)','a','p2','overwrite','hash','now').run();
  assert.equal((await put('SELECT payload FROM responses WHERE assignment_id=?','a').first()).payload,'original');
  await pg.exec(fs.readFileSync('supabase/001_schema.sql','utf8'));
  assert.equal((await put('SELECT payload FROM responses WHERE assignment_id=?','a').first()).payload,'original');
  await pg.close();
});
test('initialization fills missing tables and rejects incompatible existing columns',async()=>{
  const pg=new PGlite();
  await pg.exec('CREATE SCHEMA survey; CREATE TABLE survey.analysis_runs(id text PRIMARY KEY NOT NULL,study_id text NOT NULL,input_hash text NOT NULL,result text NOT NULL,created_at text NOT NULL);');
  await pg.exec(fs.readFileSync('supabase/001_schema.sql','utf8'));
  assert.equal((await pg.query('SELECT COUNT(*) AS n FROM survey.questions')).rows[0].n,0);
  await pg.exec('ALTER TABLE survey.analysis_runs DROP COLUMN result');
  await assert.rejects(pg.exec(fs.readFileSync('supabase/001_schema.sql','utf8')),/survey schema is incompatible.*analysis_runs.result/);
  await pg.exec('ROLLBACK');
  await pg.close();
});
test('mixed-game reservations stay within five reviewers under concurrent claims',async()=>{
 const pg=new PGlite();await pg.exec(fs.readFileSync('supabase/001_schema.sql','utf8'));
 const db=createDatabase({query:async(s,v)=>(await pg.query(s,v)).rows,transaction:fn=>pg.transaction(tx=>fn(async(s,v)=>(await tx.query(s,v)).rows))});
 await pg.query("INSERT INTO survey.studies(id,status,config,created_at) VALUES('s','live','{}','now')");
 for(let i=0;i<10;i++)await pg.query('INSERT INTO survey.questions(id,study_id,game,kind,payload,digest,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',['q'+i,'s',i<4||i>=8?'a':'b',i<8?'main':i===8?'control_positive':'control_negative','{}','test','now']);
 for(let i=0;i<8;i++)await pg.query('INSERT INTO survey.participants(id,game,resume_hash,profile,status,created_at) VALUES($1,$2,$3,$4,$5,$6)',['p'+i,'a','p'+i,JSON.stringify({games:['a','b'],flexible:true}),'training','now']);
 const claims=await Promise.all(Array.from({length:8},(_,i)=>db.flexiblePanel('p'+i,'s','now')));assert.equal(claims.filter(n=>n>0).length,5);
 const counts=(await pg.query("SELECT a.question_id,COUNT(*) AS n FROM survey.assignments a JOIN survey.participants p ON p.panel_id=a.panel_id WHERE a.trial_type='main' GROUP BY a.question_id")).rows;
 assert.equal(counts.length,8);assert.ok(counts.every(c=>Number(c.n)===5));
 assert.equal(await db.finishParticipant('p0','s','now'),false);
 await pg.close();
});
