-- =============================================================================
-- 0012 · Spec 011: card_statement_marks is create/delete only. Supabase's default privileges give
-- `authenticated` every privilege on new tables in public, so 0011's grant left UPDATE, TRUNCATE,
-- REFERENCES and TRIGGER in place too (pgTAP card-statement-marks.test.sql caught it). A mark is
-- only ever created or removed, never edited.
-- =============================================================================
revoke update, truncate, references, trigger on public.card_statement_marks from authenticated;
