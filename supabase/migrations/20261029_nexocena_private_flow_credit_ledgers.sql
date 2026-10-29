-- Private per-user Google Flow planning ledger; values are manual, never provider billing.
create table if not exists nexocena_private.flow_credit_ledgers (
 user_id uuid primary key references nexocena_private.users(id) on delete cascade,
 balance integer not null default 0 check (balance >= 0),
 confirmed integer not null default 0 check (confirmed >= 0),
 updated_at timestamptz not null default now()
);
revoke all on nexocena_private.flow_credit_ledgers from public, anon, authenticated;
alter table nexocena_private.flow_credit_ledgers enable row level security;
