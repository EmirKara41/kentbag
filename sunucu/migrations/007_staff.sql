CREATE TABLE IF NOT EXISTS staff_member (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('center','institution','crew')),
  unit_id text,
  team_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role='center' AND unit_id IS NULL AND team_id IS NULL)
    OR (role='institution' AND unit_id IS NOT NULL AND team_id IS NULL)
    OR (role='crew' AND unit_id IS NOT NULL AND team_id IS NOT NULL))
);
