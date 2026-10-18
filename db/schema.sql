-- StudyPatch PostgreSQL schema (Aurora PostgreSQL / RDS). Design goals: tenant isolation via row-level
-- security, data minimisation (no DOB, contact or health fields), pseudonymous student identifiers,
-- retention-friendly timestamps. Not yet executed against a live database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenant (
  tenant_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  region           text NOT NULL,
  retention_assessment_months int NOT NULL DEFAULT 24 CHECK (retention_assessment_months BETWEEN 6 AND 84),
  retention_practice_months   int NOT NULL DEFAULT 12 CHECK (retention_practice_months BETWEEN 3 AND 60),
  pseudonymise_after_months   int NOT NULL DEFAULT 12,
  delete_after_leaving_days   int NOT NULL DEFAULT 90,
  daily_ai_item_cap           int NOT NULL DEFAULT 40,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE staff_role AS ENUM ('teacher','admin');
CREATE TABLE staff_user (
  user_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant ON DELETE CASCADE,
  idp_subject text NOT NULL,              -- Cognito/SSO subject; no passwords stored here
  display_name text NOT NULL,
  email      text NOT NULL,
  role       staff_role NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, idp_subject)
);

CREATE TABLE class (
  class_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant ON DELETE CASCADE,
  name       text NOT NULL,
  year_level text,
  teacher_id uuid NOT NULL REFERENCES staff_user
);

CREATE TABLE student (
  student_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant ON DELETE CASCADE,
  class_id     uuid REFERENCES class,
  pseudonym    text NOT NULL,              -- e.g. 7A-01; used in analytics, exports and AI payloads
  display_name text,                       -- nullable: erased by retention job after pseudonymise_after
  idp_subject  text,                       -- student login (SSO / school-managed), optional
  active       boolean NOT NULL DEFAULT true,
  left_at      timestamptz,
  UNIQUE (tenant_id, pseudonym)
  -- Deliberately absent: date of birth, address, phone, parent contact, SEN/health/ethnicity fields.
);

CREATE TABLE skill (
  skill_id   text NOT NULL,
  tenant_id  uuid NOT NULL REFERENCES tenant ON DELETE CASCADE,
  framework  text NOT NULL,
  name       text NOT NULL,
  PRIMARY KEY (tenant_id, skill_id)
);
CREATE TABLE skill_prerequisite (
  tenant_id uuid NOT NULL, skill_id text NOT NULL, prerequisite_id text NOT NULL,
  PRIMARY KEY (tenant_id, skill_id, prerequisite_id),
  FOREIGN KEY (tenant_id, skill_id) REFERENCES skill, FOREIGN KEY (tenant_id, prerequisite_id) REFERENCES skill
);
CREATE TABLE learning_objective (
  objective_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, skill_id text NOT NULL, text text NOT NULL,
  FOREIGN KEY (tenant_id, skill_id) REFERENCES skill
);
CREATE TABLE misconception (
  misconception_id text NOT NULL, tenant_id uuid NOT NULL, skill_id text NOT NULL,
  name text NOT NULL, description text NOT NULL, teaching_move text,
  PRIMARY KEY (tenant_id, misconception_id), FOREIGN KEY (tenant_id, skill_id) REFERENCES skill
);

CREATE TYPE content_source AS ENUM ('library','teacher','ai');
CREATE TYPE review_status  AS ENUM ('draft','approved','rejected','withdrawn');
CREATE TABLE question (
  question_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant ON DELETE CASCADE,
  skill_id    text NOT NULL,
  difficulty  smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  stem        text NOT NULL,
  source      content_source NOT NULL,
  status      review_status NOT NULL DEFAULT 'draft',
  generated_by_model text,                 -- Bedrock model id + prompt version for AI items
  reviewed_by uuid REFERENCES staff_user,
  reviewed_at timestamptz,
  FOREIGN KEY (tenant_id, skill_id) REFERENCES skill,
  -- AI content can never be approved without a named human reviewer.
  CHECK (source <> 'ai' OR status NOT IN ('approved') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE TABLE question_option (
  question_id uuid NOT NULL REFERENCES question ON DELETE CASCADE,
  position smallint NOT NULL, text text NOT NULL, is_correct boolean NOT NULL DEFAULT false,
  misconception_id text, tenant_id uuid NOT NULL,
  PRIMARY KEY (question_id, position)
);
CREATE UNIQUE INDEX one_correct_option ON question_option (question_id) WHERE is_correct;

CREATE TABLE assessment (
  assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant ON DELETE CASCADE,
  title text NOT NULL, created_by uuid NOT NULL REFERENCES staff_user,
  status text NOT NULL DEFAULT 'draft', due_on date,
  min_questions smallint NOT NULL, max_questions smallint NOT NULL,
  min_difficulty smallint NOT NULL, max_difficulty smallint NOT NULL, start_difficulty smallint NOT NULL,
  max_per_skill smallint NOT NULL, allow_followups boolean NOT NULL DEFAULT true, show_student_summary boolean NOT NULL DEFAULT true,
  CHECK (min_questions <= max_questions AND min_difficulty <= max_difficulty AND start_difficulty BETWEEN min_difficulty AND max_difficulty)
);
CREATE TABLE assessment_skill (assessment_id uuid REFERENCES assessment ON DELETE CASCADE, skill_id text, tenant_id uuid NOT NULL, PRIMARY KEY (assessment_id, skill_id));
CREATE TABLE assessment_class (assessment_id uuid REFERENCES assessment ON DELETE CASCADE, class_id uuid REFERENCES class, PRIMARY KEY (assessment_id, class_id));

CREATE TABLE attempt (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, assessment_id uuid NOT NULL REFERENCES assessment,
  student_id uuid NOT NULL REFERENCES student,
  started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE TABLE response (
  response_id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL, attempt_id uuid NOT NULL REFERENCES attempt ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES question, position smallint NOT NULL,
  chosen_option smallint NOT NULL, is_correct boolean NOT NULL, misconception_id text,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, position)
);
CREATE TABLE skill_evidence (               -- derived by the processing Lambda; recomputable
  attempt_id uuid REFERENCES attempt ON DELETE CASCADE, skill_id text, tenant_id uuid NOT NULL,
  n smallint NOT NULL, weighted_score numeric(4,3) NOT NULL,
  label text NOT NULL CHECK (label IN ('Secure','Developing','Needs practice','Not enough evidence')),
  PRIMARY KEY (attempt_id, skill_id)
);

CREATE TABLE practice_set (
  practice_set_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL, skill_id text NOT NULL, misconception_id text,
  title text NOT NULL, content jsonb NOT NULL,         -- worked example, items, hints, explanations
  ai_generated boolean NOT NULL DEFAULT true,
  model_id text, prompt_version text, validation jsonb NOT NULL,
  status review_status NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES staff_user, reviewed_by uuid REFERENCES staff_user, reviewed_at timestamptz,
  teacher_note text, reject_reason text,
  CHECK (status <> 'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE TABLE practice_assignment (
  practice_set_id uuid REFERENCES practice_set ON DELETE CASCADE, student_id uuid REFERENCES student, tenant_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (practice_set_id, student_id)
);
CREATE TABLE practice_response (
  practice_response_id bigserial PRIMARY KEY, tenant_id uuid NOT NULL,
  practice_set_id uuid NOT NULL, student_id uuid NOT NULL, item_index smallint NOT NULL,
  chosen_option smallint NOT NULL, is_correct boolean NOT NULL, hints_used smallint NOT NULL DEFAULT 0, answered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_event (
  event_id bigserial PRIMARY KEY, tenant_id uuid NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL, actor_id uuid, event text NOT NULL, detail jsonb NOT NULL DEFAULT '{}'   -- IDs only, no answers or names
);

CREATE INDEX ON attempt (tenant_id, student_id, completed_at);
CREATE INDEX ON response (attempt_id);
CREATE INDEX ON practice_response (tenant_id, student_id);

-- ---------- Row-level security: every query runs with SET LOCAL app.tenant_id / app.user_id / app.role ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['class','student','skill','learning_objective','misconception','question','question_option','assessment','assessment_skill','attempt','response','skill_evidence','practice_set','practice_assignment','practice_response','audit_event','staff_user']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting('app.tenant_id')::uuid)$p$, t);
  END LOOP;
END $$;

-- Teachers only see students/attempts in their own classes; students only their own rows; admins see no row-level answers.
CREATE POLICY teacher_students ON student FOR SELECT USING (
  current_setting('app.role') = 'teacher' AND class_id IN (SELECT class_id FROM class WHERE teacher_id = current_setting('app.user_id')::uuid));
CREATE POLICY student_self ON student FOR SELECT USING (current_setting('app.role') = 'student' AND student_id = current_setting('app.user_id')::uuid);
CREATE POLICY teacher_attempts ON attempt FOR SELECT USING (
  current_setting('app.role') = 'teacher' AND student_id IN (SELECT student_id FROM student s JOIN class c USING (class_id) WHERE c.teacher_id = current_setting('app.user_id')::uuid));
CREATE POLICY student_attempts ON attempt FOR SELECT USING (current_setting('app.role') = 'student' AND student_id = current_setting('app.user_id')::uuid);
-- Admin reads aggregates only, through a view that applies small-cell suppression:
CREATE VIEW school_skill_distribution AS
  SELECT e.tenant_id, e.skill_id, e.label, count(*) AS n
  FROM skill_evidence e GROUP BY e.tenant_id, e.skill_id, e.label HAVING count(*) >= 5;
