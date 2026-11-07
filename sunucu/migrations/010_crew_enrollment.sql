CREATE TABLE IF NOT EXISTS crew_enrollment (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  unit_id text NOT NULL,
  team_id text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')),
  review_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
