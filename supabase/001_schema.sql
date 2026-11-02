-- Safe to rerun: preserves existing rows and checks expected column structure.
BEGIN;
CREATE SCHEMA IF NOT EXISTS survey;
SET LOCAL search_path TO survey;
CREATE TABLE IF NOT EXISTS analysis_runs (
	id text PRIMARY KEY NOT NULL,
	study_id text NOT NULL,
	input_hash text NOT NULL,
	result text NOT NULL,
	created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
	id text PRIMARY KEY NOT NULL,
	panel_id text NOT NULL,
	question_id text NOT NULL,
	ordinal integer NOT NULL,
	trial_type text NOT NULL,
	repeat_of text
);

CREATE UNIQUE INDEX IF NOT EXISTS assignments_panel_order ON assignments (panel_id,ordinal);
CREATE TABLE IF NOT EXISTS audit_events (
	id text PRIMARY KEY NOT NULL,
	actor text NOT NULL,
	action text NOT NULL,
	payload text NOT NULL,
	created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
	assignment_id text PRIMARY KEY NOT NULL,
	participant_id text NOT NULL,
	payload text NOT NULL,
	updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS panels (
	id text PRIMARY KEY NOT NULL,
	study_id text NOT NULL,
	game text NOT NULL,
	slot integer NOT NULL,
	created_at text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS panels_game_slot ON panels (study_id,game,slot);
CREATE TABLE IF NOT EXISTS participants (
	id text PRIMARY KEY NOT NULL,
	panel_id text,
	game text NOT NULL,
	resume_hash text NOT NULL,
	training text DEFAULT '{}' NOT NULL,
	session_hash text,
	profile text NOT NULL,
	status text NOT NULL,
	consented_at text,
	qualified_at text,
	qualification_attempts integer DEFAULT 0 NOT NULL,
	exclusion_reason text,
	created_at text NOT NULL,
	completed_at text
);

CREATE UNIQUE INDEX IF NOT EXISTS participants_panel ON participants (panel_id);
CREATE UNIQUE INDEX IF NOT EXISTS participants_session ON participants (session_hash);
CREATE UNIQUE INDEX IF NOT EXISTS participants_resume ON participants (resume_hash);
CREATE TABLE IF NOT EXISTS questions (
	id text PRIMARY KEY NOT NULL,
	study_id text NOT NULL,
	game text NOT NULL,
	kind text NOT NULL,
	payload text NOT NULL,
	expected text,
	digest text NOT NULL,
	created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS responses (
	assignment_id text PRIMARY KEY NOT NULL,
	participant_id text NOT NULL,
	payload text NOT NULL,
	digest text NOT NULL,
	submitted_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS studies (
	id text PRIMARY KEY NOT NULL,
	status text NOT NULL,
	config text NOT NULL,
	pool_hash text,
	frozen_at text,
	created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS media_assets (
	question_id text PRIMARY KEY NOT NULL,
	storage_key text NOT NULL,
	sha256 text NOT NULL,
	bytes integer NOT NULL,
	uploaded_at text NOT NULL
);


-- IF NOT EXISTS preserves data; this check rejects incompatible existing columns.
DO $$
DECLARE problems text;
BEGIN
  WITH expected(table_name,column_name,data_type,is_nullable) AS (
    VALUES
      ('analysis_runs','id','text','NO'),
      ('analysis_runs','study_id','text','NO'),
      ('analysis_runs','input_hash','text','NO'),
      ('analysis_runs','result','text','NO'),
      ('analysis_runs','created_at','text','NO'),
      ('assignments','id','text','NO'),
      ('assignments','panel_id','text','NO'),
      ('assignments','question_id','text','NO'),
      ('assignments','ordinal','integer','NO'),
      ('assignments','trial_type','text','NO'),
      ('assignments','repeat_of','text','YES'),
      ('audit_events','id','text','NO'),
      ('audit_events','actor','text','NO'),
      ('audit_events','action','text','NO'),
      ('audit_events','payload','text','NO'),
      ('audit_events','created_at','text','NO'),
      ('drafts','assignment_id','text','NO'),
      ('drafts','participant_id','text','NO'),
      ('drafts','payload','text','NO'),
      ('drafts','updated_at','text','NO'),
      ('panels','id','text','NO'),
      ('panels','study_id','text','NO'),
      ('panels','game','text','NO'),
      ('panels','slot','integer','NO'),
      ('panels','created_at','text','NO'),
      ('participants','id','text','NO'),
      ('participants','panel_id','text','YES'),
      ('participants','game','text','NO'),
      ('participants','resume_hash','text','NO'),
      ('participants','training','text','NO'),
      ('participants','session_hash','text','YES'),
      ('participants','profile','text','NO'),
      ('participants','status','text','NO'),
      ('participants','consented_at','text','YES'),
      ('participants','qualified_at','text','YES'),
      ('participants','qualification_attempts','integer','NO'),
      ('participants','exclusion_reason','text','YES'),
      ('participants','created_at','text','NO'),
      ('participants','completed_at','text','YES'),
      ('questions','id','text','NO'),
      ('questions','study_id','text','NO'),
      ('questions','game','text','NO'),
      ('questions','kind','text','NO'),
      ('questions','payload','text','NO'),
      ('questions','expected','text','YES'),
      ('questions','digest','text','NO'),
      ('questions','created_at','text','NO'),
      ('responses','assignment_id','text','NO'),
      ('responses','participant_id','text','NO'),
      ('responses','payload','text','NO'),
      ('responses','digest','text','NO'),
      ('responses','submitted_at','text','NO'),
      ('studies','id','text','NO'),
      ('studies','status','text','NO'),
      ('studies','config','text','NO'),
      ('studies','pool_hash','text','YES'),
      ('studies','frozen_at','text','YES'),
      ('studies','created_at','text','NO'),
      ('media_assets','question_id','text','NO'),
      ('media_assets','storage_key','text','NO'),
      ('media_assets','sha256','text','NO'),
      ('media_assets','bytes','integer','NO'),
      ('media_assets','uploaded_at','text','NO')
  )
  SELECT string_agg(e.table_name || '.' || e.column_name, ', ' ORDER BY e.table_name,e.column_name)
  INTO problems
  FROM expected e
  LEFT JOIN information_schema.columns c
    ON c.table_schema='survey' AND c.table_name=e.table_name AND c.column_name=e.column_name
  WHERE c.column_name IS NULL OR c.data_type<>e.data_type OR c.is_nullable<>e.is_nullable;
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION 'Existing survey schema is incompatible (missing or different columns): %', problems;
  END IF;
END $$;

ALTER TABLE survey.studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey.media_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA survey FROM PUBLIC;
COMMIT;
