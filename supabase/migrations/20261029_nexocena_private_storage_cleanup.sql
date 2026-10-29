-- Incremental, non-destructive. Records objects awaiting compensated deletion.
create table if not exists nexocena_private.storage_cleanup (
 id uuid primary key,
 created_at timestamptz not null default now()
);
revoke all on nexocena_private.storage_cleanup from public, anon, authenticated;
alter table nexocena_private.storage_cleanup enable row level security;
create index if not exists nexocena_video_jobs_status_idx on nexocena_private.video_jobs(status);
