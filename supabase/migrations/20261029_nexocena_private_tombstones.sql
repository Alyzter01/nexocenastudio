-- Preserve generation/quote audit FK references while maintaining DELETE API behavior.
alter table nexocena_private.projects add column if not exists deleted_at timestamptz;
