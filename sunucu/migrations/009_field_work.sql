ALTER TABLE institution_work_order DROP CONSTRAINT IF EXISTS institution_work_order_state_check;
ALTER TABLE institution_work_order ADD CONSTRAINT institution_work_order_state_check CHECK(state IN ('prepared','cancelled','completed'));
ALTER TABLE institution_work_order ADD COLUMN IF NOT EXISTS crew_state text NOT NULL DEFAULT 'assigned' CHECK(crew_state IN ('assigned','accepted','in_progress','institution_review','center_review','published'));
ALTER TABLE institution_work_order ADD COLUMN IF NOT EXISTS result jsonb;
ALTER TABLE institution_work_order ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE institution_work_order ADD COLUMN IF NOT EXISTS accepted_by text REFERENCES "user"(id);
ALTER TABLE institution_work_order ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE institution_work_order ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE institution_work_order ADD COLUMN IF NOT EXISTS completed_at timestamptz;
CREATE TABLE IF NOT EXISTS field_work_event (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES institution_work_order(id) ON DELETE CASCADE,
  stage text NOT NULL,
  body text NOT NULL,
  actor_id text REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS field_work_team ON institution_work_order(unit_id,team_id,crew_state);
