// KentBağ SQL schema, applied in order by migrateApp. Only additive changes after 001.
// Kept in TypeScript so the cloud bundle carries it.
export const migrations: { name: string; sql: string }[] = [
  {
    name: "001_init",
    sql: `
CREATE TABLE IF NOT EXISTS staff (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('center','institution','crew')),
  institution_id text,
  team_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role='center' AND institution_id IS NULL AND team_id IS NULL)
      OR (role='institution' AND institution_id IS NOT NULL AND team_id IS NULL)
      OR (role='crew' AND institution_id IS NOT NULL AND team_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS team (
  id text PRIMARY KEY,
  institution_id text NOT NULL,
  name text NOT NULL,
  on_shift boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  lat double precision,
  lng double precision,
  located_at timestamptz
);
CREATE TABLE IF NOT EXISTS request (
  id uuid PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  citizen_id text NOT NULL REFERENCES "user"(id),
  client_request_id text NOT NULL,
  kind text NOT NULL,
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  description text NOT NULL,
  address text NOT NULL DEFAULT '',
  lat double precision,
  lng double precision,
  photo_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL,
  institution_id text,
  team_id text REFERENCES team(id),
  queue_order integer,
  remaining_minutes integer,
  remaining_set_at timestamptz,
  eta_arrival timestamptz,
  eta_finish timestamptz,
  agent_reason text,
  resolution_note text,
  resolution_photo_ids text[] NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (citizen_id, client_request_id)
);
CREATE INDEX IF NOT EXISTS request_status ON request(status);
CREATE INDEX IF NOT EXISTS request_team ON request(team_id, queue_order);
CREATE TABLE IF NOT EXISTS request_event (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES request(id) ON DELETE CASCADE,
  status text NOT NULL,
  type text NOT NULL,
  body text NOT NULL,
  public boolean NOT NULL,
  actor_role text NOT NULL,
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_event_request ON request_event(request_id, created_at);
CREATE TABLE IF NOT EXISTS photo (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  client_id text NOT NULL,
  request_id uuid,
  path text NOT NULL,
  content_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, client_id)
);
CREATE TABLE IF NOT EXISTS setting (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS push_token (
  token text PRIMARY KEY,
  user_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`,
  },
  {
    name: "002_faz2",
    sql: `
-- Faz 2: only additions, so Faz 1 code keeps working on this schema.
ALTER TABLE request ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES request(id);
CREATE INDEX IF NOT EXISTS request_merged_into ON request(merged_into);
CREATE INDEX IF NOT EXISTS request_category_status ON request(category, status);

CREATE TABLE IF NOT EXISTS request_supporter (
  request_id uuid NOT NULL REFERENCES request(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);
CREATE INDEX IF NOT EXISTS request_supporter_user ON request_supporter(user_id);

CREATE TABLE IF NOT EXISTS announcement (
  id uuid PRIMARY KEY,
  institution_id text,
  title text NOT NULL,
  body text NOT NULL,
  neighborhood text,
  request_id uuid REFERENCES request(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcement_active ON announcement(ends_at);

CREATE TABLE IF NOT EXISTS crew_application (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  institution_id text NOT NULL,
  team_id text NOT NULL REFERENCES team(id),
  phone text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decision_note text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crew_application_pending ON crew_application(user_id) WHERE status = 'pending';
`,
  },
  {
    name: "003_photo_checks",
    sql: `
-- Advisory AI checks: does the citizen's photo fit the report, does the crew's closing photo confirm the fix.
ALTER TABLE request ADD COLUMN IF NOT EXISTS photo_check jsonb;
ALTER TABLE request ADD COLUMN IF NOT EXISTS resolution_check jsonb;
`,
  },
];
