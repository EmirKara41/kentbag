CREATE TABLE IF NOT EXISTS institution_case (
  report_id text PRIMARY KEY REFERENCES citizen_report(id) ON DELETE CASCADE,
  id text NOT NULL UNIQUE,
  unit_id text NOT NULL,
  state text NOT NULL CHECK(state IN ('queued','accepted','returned')),
  instruction text NOT NULL,
  return_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS institution_case_unit ON institution_case(unit_id,state);
CREATE TABLE IF NOT EXISTS institution_case_event (
  id text PRIMARY KEY,
  report_id text NOT NULL REFERENCES citizen_report(id) ON DELETE CASCADE,
  delivery_id text NOT NULL,
  unit_id text NOT NULL,
  kind text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS institution_work_order (
  id text PRIMARY KEY,
  report_id text NOT NULL REFERENCES citizen_report(id) ON DELETE CASCADE,
  delivery_id text NOT NULL,
  unit_id text NOT NULL,
  team_id text NOT NULL,
  instruction text NOT NULL,
  priority text NOT NULL CHECK(priority IN ('low','normal','high','urgent')),
  state text NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS institution_work_order_active
  ON institution_work_order(report_id) WHERE state='prepared';
