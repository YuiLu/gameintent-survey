import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {compileSql,createDatabase} from '../lib/study/database.mjs';

test('PostgreSQL preserves quoted question marks and upserts',()=>{
  assert.equal(compileSql("SELECT '?' FROM studies WHERE id=?"),"SELECT '?' FROM survey.studies WHERE id=$1");
  assert.match(compileSql('INSERT OR IGNORE INTO responses VALUES (?)'),/survey.responses VALUES \(\$1\) ON CONFLICT DO NOTHING$/);
});
test('real PostgreSQL schema, atomic batches, unique claims and immutable responses',async()=>{
  const pg=new PGlite();await pg.exec(fs.readFileSync('supabase/001_schema.sql','utf8'));
  const db=createDatabase({query:async(s,v)=>(await pg.query(s,v)).rows,
    transaction:fn=>pg.transaction(tx=>fn(async(s,v)=>(await tx.query(s,v)).rows))});
  const put=(s,...v)=>db.prepare(s).bind(...v);
  await put('INSERT INTO studies(id,status,config,created_at) VALUES (?,?,?,?)','s','draft','{}','now').run();
  assert.equal((await put('SELECT COUNT(*) AS n FROM studies').first()).n,1);
  await assert.rejects(db.batch([put('INSERT INTO studies(id,status,config,created_at) VALUES (?,?,?,?)','rollback','draft','{}','now'),put('INSERT INTO studies(id,status,config,created_at) VALUES (?,?,?,?)','s','draft','{}','now')]));
  assert.equal(await put('SELECT id FROM studies WHERE id=?','rollback').first(),null);
  await put('INSERT INTO panels(id,study_id,game,slot,created_at) VALUES (?,?,?,?,?)','panel','s','cs',0,'now').run();
  for(const id of ['p1','p2'])await put('INSERT INTO participants(id,game,resume_hash,profile,status,created_at) VALUES (?,?,?,?,?,?)',id,'cs',id,'{}','training','now').run();
  await Promise.all(['p1','p2'].map(id=>db.claimPanel(id,'s','cs','now')));
  assert.equal((await put('SELECT COUNT(*) AS n FROM participants WHERE panel_id IS NOT NULL').first()).n,1);
  await put('INSERT OR IGNORE INTO responses(assignment_id,participant_id,payload,digest,submitted_at) VALUES (?,?,?,?,?)','a','p1','original','hash','now').run();
  await put('INSERT OR IGNORE INTO responses(assignment_id,participant_id,payload,digest,submitted_at) VALUES (?,?,?,?,?)','a','p2','overwrite','hash','now').run();
  assert.equal((await put('SELECT payload FROM responses WHERE assignment_id=?','a').first()).payload,'original');
  await pg.close();
});
