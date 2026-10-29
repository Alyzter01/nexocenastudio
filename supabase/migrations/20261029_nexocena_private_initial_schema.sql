-- NEXOCENA STUDIO: private PostgreSQL schema (applied to Supabase on 2026-10-29)
-- Never expose this schema via the Supabase Data API or grant anon/authenticated.
create schema if not exists nexocena_private;
create table if not exists nexocena_private.users (id uuid primary key,email text unique not null,password text not null);
create table if not exists nexocena_private.sessions (token text primary key,user_id uuid not null references nexocena_private.users(id),expires bigint not null);
create table if not exists nexocena_private.projects (id uuid primary key,user_id uuid not null references nexocena_private.users(id),data jsonb not null,revision integer not null default 1 check(revision>0),updated_at timestamptz not null default now());
create index if not exists nexocena_projects_user_updated_idx on nexocena_private.projects(user_id,updated_at desc);
create table if not exists nexocena_private.versions (id uuid primary key,project_id uuid not null references nexocena_private.projects(id) on delete cascade,data jsonb not null,revision integer not null,created_at timestamptz not null default now());
create table if not exists nexocena_private.media (id uuid primary key,user_id uuid not null references nexocena_private.users(id),name text not null,mime text not null,size bigint not null check(size>=0),created_at timestamptz not null default now());
create index if not exists nexocena_media_user_created_idx on nexocena_private.media(user_id,created_at desc);
create table if not exists nexocena_private.video_quotes (id uuid primary key,user_id uuid not null references nexocena_private.users(id),project_id uuid not null references nexocena_private.projects(id),scene_id uuid not null,input jsonb not null,credits numeric not null,expires bigint not null);
create table if not exists nexocena_private.video_jobs (id uuid primary key,user_id uuid not null references nexocena_private.users(id),quote_id uuid unique not null references nexocena_private.video_quotes(id),project_id uuid not null references nexocena_private.projects(id),scene_id uuid not null,status text not null,task_id text,output jsonb,media_id uuid references nexocena_private.media(id),error text,last_poll bigint not null default 0,created_at timestamptz not null default now());
create index if not exists nexocena_video_jobs_user_created_idx on nexocena_private.video_jobs(user_id,created_at desc);
revoke all on schema nexocena_private from public,anon,authenticated;
revoke all on all tables in schema nexocena_private from public,anon,authenticated;
alter default privileges in schema nexocena_private revoke all on tables from public,anon,authenticated;
alter table nexocena_private.users enable row level security;
alter table nexocena_private.sessions enable row level security;
alter table nexocena_private.projects enable row level security;
alter table nexocena_private.versions enable row level security;
alter table nexocena_private.media enable row level security;
alter table nexocena_private.video_quotes enable row level security;
alter table nexocena_private.video_jobs enable row level security;
