-- Restore shared status notifications that previously reached subscribers only.
-- Stable IDs and the legacy body/time match make repeated startup safe.
INSERT INTO citizen_inbox(id,owner_id,report_id,document,created_at)
SELECT 'community-owner-' || e.id, r.owner_id, r.id,
  jsonb_build_object('id','community-owner-' || e.id,'ownerId',r.owner_id,
    'reportId',r.id,'communityEventId',e.id,'title','Talebinde yeni gelişme',
    'body',e.body,'createdAt',e.created_at,'read',false), e.created_at
FROM community_event e
JOIN community_issue i ON i.id=e.issue_id
JOIN citizen_report r ON r.id=i.report_id
WHERE e.body LIKE 'Kurum kaydındaki son durum:%'
  AND NOT EXISTS (
    SELECT 1 FROM citizen_inbox n WHERE n.owner_id=r.owner_id AND n.report_id=r.id
    AND (n.document->>'communityEventId'=e.id
      OR (n.document->>'body'=e.body AND abs(extract(epoch FROM n.created_at-e.created_at)) < 5))
  )
ON CONFLICT(id) DO NOTHING;

UPDATE citizen_report r SET document=jsonb_set(r.document,'{events}',
  (SELECT jsonb_agg(event ORDER BY (event->>'createdAt')::timestamptz)
   FROM jsonb_array_elements(COALESCE(r.document->'events','[]'::jsonb) || restored.events) event))
FROM (
  SELECT i.report_id, jsonb_agg(jsonb_build_object('id',e.id,'body',e.body,
    'status',e.status,'createdAt',e.created_at) ORDER BY e.created_at) AS events
  FROM community_event e
  JOIN community_issue i ON i.id=e.issue_id
  JOIN citizen_report original ON original.id=i.report_id
  WHERE e.body LIKE 'Kurum kaydındaki son durum:%'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(original.document->'events') previous
      WHERE previous->>'id'=e.id
        OR (previous->>'body'=e.body AND abs(extract(epoch FROM (previous->>'createdAt')::timestamptz-e.created_at)) < 5)
    )
  GROUP BY i.report_id
) restored WHERE r.id=restored.report_id;
