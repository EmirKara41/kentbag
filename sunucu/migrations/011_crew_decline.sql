ALTER TABLE institution_work_order DROP CONSTRAINT IF EXISTS institution_work_order_crew_state_check;
ALTER TABLE institution_work_order ADD CONSTRAINT institution_work_order_crew_state_check CHECK(crew_state IN ('assigned','accepted','in_progress','institution_review','center_review','published','declined'));
ALTER TABLE institution_work_order ADD COLUMN IF NOT EXISTS decline_reason text;
