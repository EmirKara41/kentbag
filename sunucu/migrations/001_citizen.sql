CREATE TABLE IF NOT EXISTS citizen_profile (
  owner_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS citizen_report (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  fingerprint text NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, request_id)
);
CREATE INDEX IF NOT EXISTS citizen_report_owner ON citizen_report(owner_id, created_at DESC);
CREATE TABLE IF NOT EXISTS citizen_photo (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  pathname text NOT NULL,
  digest text NOT NULL,
  width integer NOT NULL CHECK(width > 0),
  height integer NOT NULL CHECK(height > 0),
  report_id text REFERENCES citizen_report(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, client_id)
);
CREATE INDEX IF NOT EXISTS citizen_photo_owner ON citizen_photo(owner_id, created_at DESC);
CREATE TABLE IF NOT EXISTS citizen_inbox (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  report_id text NOT NULL REFERENCES citizen_report(id) ON DELETE CASCADE,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS citizen_inbox_owner ON citizen_inbox(owner_id, created_at DESC);
