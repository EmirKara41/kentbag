CREATE TABLE IF NOT EXISTS institution_mail (
  id text PRIMARY KEY,
  report_id text NOT NULL REFERENCES citizen_report(id) ON DELETE CASCADE,
  delivery_id text NOT NULL UNIQUE,
  unit_id text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','failed')),
  provider_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
