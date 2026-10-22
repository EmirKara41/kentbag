-- Older shared operator messages had no type in the owner's timeline.
-- Label only messages with a matching shared event; do not infer from arbitrary text.
UPDATE citizen_report r SET document=jsonb_set(r.document,'{events}',
  (SELECT jsonb_agg(CASE WHEN EXISTS (
      SELECT 1 FROM community_event c JOIN community_issue i ON i.id=c.issue_id
      WHERE i.report_id=r.id AND c.body=event->>'body'
        AND c.body NOT LIKE 'Kurum kaydındaki son durum:%'
        AND abs(extract(epoch FROM c.created_at-(event->>'createdAt')::timestamptz)) < 5
    ) THEN event || '{"kind":"message"}'::jsonb ELSE event END ORDER BY position)
    FROM jsonb_array_elements(r.document->'events') WITH ORDINALITY AS source(event,position)))
WHERE EXISTS (SELECT 1 FROM community_issue i JOIN community_event c ON c.issue_id=i.id
  WHERE i.report_id=r.id AND c.body NOT LIKE 'Kurum kaydındaki son durum:%');
