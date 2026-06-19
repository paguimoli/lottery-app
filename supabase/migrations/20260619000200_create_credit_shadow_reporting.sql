create table if not exists public.credit_shadow_runs (
  id uuid primary key default gen_random_uuid(),
  correlation_id text,
  operation_type text not null,
  account_id text not null,
  wallet_id text null,
  ticket_id text null,
  reservation_id text null,
  comparison_status text not null,
  shadow_amount_minor bigint not null,
  monolith_amount_minor bigint null,
  shadow_available_credit bigint null,
  monolith_available_credit bigint null,
  shadow_reserved_amount bigint null,
  monolith_reserved_amount bigint null,
  shadow_released_amount bigint null,
  monolith_released_amount bigint null,
  shadow_remaining_exposure bigint null,
  monolith_remaining_exposure bigint null,
  shadow_balance_impact bigint null,
  monolith_balance_impact bigint null,
  currency text not null,
  shadow_service_version text null,
  created_at timestamptz not null default now(),
  constraint credit_shadow_runs_operation_type_check
    check (operation_type in ('RESERVE', 'RELEASE', 'SETTLEMENT')),
  constraint credit_shadow_runs_comparison_status_check
    check (comparison_status in ('MATCH', 'MISMATCH', 'NOT_COMPARED')),
  constraint credit_shadow_runs_currency_check
    check (currency ~ '^[A-Z]{3}$')
);

create table if not exists public.credit_shadow_mismatches (
  id uuid primary key default gen_random_uuid(),
  shadow_run_id uuid not null references public.credit_shadow_runs(id) on delete cascade,
  mismatch_type text not null,
  field_name text not null,
  monolith_value text null,
  shadow_value text null,
  severity text not null,
  created_at timestamptz not null default now(),
  constraint credit_shadow_mismatches_type_check
    check (mismatch_type in (
      'AVAILABLE_CREDIT_MISMATCH',
      'RESERVATION_AMOUNT_MISMATCH',
      'EXPOSURE_MISMATCH',
      'SETTLEMENT_CREDIT_MISMATCH',
      'CURRENCY_MISMATCH',
      'UNKNOWN_MISMATCH'
    )),
  constraint credit_shadow_mismatches_severity_check
    check (severity in ('INFO', 'WARNING', 'CRITICAL'))
);

create table if not exists public.credit_shadow_failures (
  id uuid primary key default gen_random_uuid(),
  correlation_id text null,
  reservation_id text null,
  ticket_id text null,
  failure_reason text not null,
  failure_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_shadow_runs_reservation_id_idx
  on public.credit_shadow_runs(reservation_id);

create index if not exists credit_shadow_runs_ticket_id_idx
  on public.credit_shadow_runs(ticket_id);

create index if not exists credit_shadow_runs_correlation_id_idx
  on public.credit_shadow_runs(correlation_id);

create index if not exists credit_shadow_runs_created_at_idx
  on public.credit_shadow_runs(created_at);

create index if not exists credit_shadow_runs_comparison_status_idx
  on public.credit_shadow_runs(comparison_status);

create index if not exists credit_shadow_mismatches_shadow_run_id_idx
  on public.credit_shadow_mismatches(shadow_run_id);

create index if not exists credit_shadow_mismatches_created_at_idx
  on public.credit_shadow_mismatches(created_at);

create index if not exists credit_shadow_failures_reservation_id_idx
  on public.credit_shadow_failures(reservation_id);

create index if not exists credit_shadow_failures_ticket_id_idx
  on public.credit_shadow_failures(ticket_id);

create index if not exists credit_shadow_failures_correlation_id_idx
  on public.credit_shadow_failures(correlation_id);

create index if not exists credit_shadow_failures_created_at_idx
  on public.credit_shadow_failures(created_at);

alter table public.credit_shadow_runs enable row level security;
alter table public.credit_shadow_mismatches enable row level security;
alter table public.credit_shadow_failures enable row level security;
