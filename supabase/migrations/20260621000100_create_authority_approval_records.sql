create table if not exists public.authority_approval_records (
  id uuid primary key default gen_random_uuid(),
  authority_candidate text not null,
  approval_type text not null,
  approver_user_id uuid null,
  approver_username text null,
  justification text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint authority_approval_records_candidate_check
    check (authority_candidate in ('SETTLEMENT', 'LEDGER', 'CREDIT')),
  constraint authority_approval_records_type_check
    check (approval_type in (
      'DRY_RUN_APPROVAL',
      'PROMOTION_APPROVAL',
      'ROLLBACK_APPROVAL'
    )),
  constraint authority_approval_records_justification_check
    check (length(trim(justification)) > 0)
);

create index if not exists authority_approval_records_candidate_idx
  on public.authority_approval_records(authority_candidate);

create index if not exists authority_approval_records_approval_type_idx
  on public.authority_approval_records(approval_type);

create index if not exists authority_approval_records_approver_user_id_idx
  on public.authority_approval_records(approver_user_id);

create index if not exists authority_approval_records_created_at_idx
  on public.authority_approval_records(created_at);

create or replace function public.prevent_authority_approval_record_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Authority approval records are immutable.';
end;
$$;

drop trigger if exists prevent_authority_approval_record_update
  on public.authority_approval_records;

create trigger prevent_authority_approval_record_update
before update on public.authority_approval_records
for each row
execute function public.prevent_authority_approval_record_update();

create or replace function public.prevent_authority_approval_record_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Authority approval records cannot be deleted.';
end;
$$;

drop trigger if exists prevent_authority_approval_record_delete
  on public.authority_approval_records;

create trigger prevent_authority_approval_record_delete
before delete on public.authority_approval_records
for each row
execute function public.prevent_authority_approval_record_delete();

alter table public.authority_approval_records enable row level security;
