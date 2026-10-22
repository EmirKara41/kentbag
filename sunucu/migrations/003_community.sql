CREATE TABLE IF NOT EXISTS community_issue (
  id text PRIMARY KEY,
  report_id text NOT NULL UNIQUE REFERENCES citizen_report(id) ON DELETE CASCADE,
  published boolean NOT NULL DEFAULT true,
  area text NOT NULL DEFAULT 'Oltu',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS community_subscription (
  issue_id text NOT NULL REFERENCES community_issue(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(issue_id, owner_id)
);
CREATE INDEX IF NOT EXISTS community_subscription_owner ON community_subscription(owner_id);
CREATE TABLE IF NOT EXISTS community_event (
  id text PRIMARY KEY,
  issue_id text NOT NULL REFERENCES community_issue(id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
