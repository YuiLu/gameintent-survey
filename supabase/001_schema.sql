BEGIN;
CREATE SCHEMA IF NOT EXISTS survey;
SET LOCAL search_path TO survey;
CREATE TABLE analysis_runs (
	id text PRIMARY KEY NOT NULL,
	study_id text NOT NULL,
	input_hash text NOT NULL,
	result text NOT NULL,
	created_at text NOT NULL
);

CREATE TABLE assignments (
	id text PRIMARY KEY NOT NULL,
	panel_id text NOT NULL,
	question_id text NOT NULL,
	ordinal integer NOT NULL,
	trial_type text NOT NULL,
	repeat_of text
);

CREATE UNIQUE INDEX assignments_panel_order ON assignments (panel_id,ordinal);
CREATE TABLE audit_events (
	id text PRIMARY KEY NOT NULL,
	actor text NOT NULL,
	action text NOT NULL,
	payload text NOT NULL,
	created_at text NOT NULL
);

CREATE TABLE drafts (
	assignment_id text PRIMARY KEY NOT NULL,
	participant_id text NOT NULL,
	payload text NOT NULL,
	updated_at text NOT NULL
);

CREATE TABLE panels (
	id text PRIMARY KEY NOT NULL,
	study_id text NOT NULL,
	game text NOT NULL,
	slot integer NOT NULL,
	created_at text NOT NULL
);

CREATE UNIQUE INDEX panels_game_slot ON panels (study_id,game,slot);
CREATE TABLE participants (
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

CREATE UNIQUE INDEX participants_panel ON participants (panel_id);
CREATE UNIQUE INDEX participants_session ON participants (session_hash);
CREATE UNIQUE INDEX participants_resume ON participants (resume_hash);
CREATE TABLE questions (
	id text PRIMARY KEY NOT NULL,
	study_id text NOT NULL,
	game text NOT NULL,
	kind text NOT NULL,
	payload text NOT NULL,
	expected text,
	digest text NOT NULL,
	created_at text NOT NULL
);

CREATE TABLE responses (
	assignment_id text PRIMARY KEY NOT NULL,
	participant_id text NOT NULL,
	payload text NOT NULL,
	digest text NOT NULL,
	submitted_at text NOT NULL
);

CREATE TABLE studies (
	id text PRIMARY KEY NOT NULL,
	status text NOT NULL,
	config text NOT NULL,
	pool_hash text,
	frozen_at text,
	created_at text NOT NULL
);

CREATE TABLE media_assets (
	question_id text PRIMARY KEY NOT NULL,
	storage_key text NOT NULL,
	sha256 text NOT NULL,
	bytes integer NOT NULL,
	uploaded_at text NOT NULL
);

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
