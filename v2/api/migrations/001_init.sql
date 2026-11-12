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
