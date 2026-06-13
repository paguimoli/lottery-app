create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.platform_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  email text not null,
  display_name text not null,
  identity_class text not null,
  status text not null,
  password_hash text,
  mfa_enabled boolean not null default false,
  failed_login_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  last_password_change_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_users_username_unique unique (username),
  constraint platform_users_email_unique unique (email),
  constraint platform_users_identity_class_check check (
    identity_class in (
      'PLATFORM_OPERATOR',
      'HIERARCHY_PARTICIPANT',
      'PLAYER',
      'SYSTEM_SERVICE'
    )
  ),
  constraint platform_users_status_check check (
    status in (
      'ACTIVE',
      'LOCKED',
      'DISABLED',
      'PENDING_ACTIVATION'
    )
  ),
  constraint platform_users_failed_login_attempts_check check (
    failed_login_attempts >= 0
  )
);

create table if not exists public.user_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_system_group boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_groups_name_unique unique (name)
);

create table if not exists public.user_group_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_users(id),
  group_id uuid not null references public.user_groups(id),
  created_at timestamptz not null default now(),
  constraint user_group_memberships_user_group_unique unique (user_id, group_id)
);

create table if not exists public.group_permissions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.user_groups(id),
  permission_key text not null,
  created_at timestamptz not null default now(),
  constraint group_permissions_group_permission_unique unique (
    group_id,
    permission_key
  )
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_users(id),
  session_token_hash text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint user_sessions_session_token_hash_unique unique (
    session_token_hash
  )
);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_users(id),
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint password_reset_tokens_token_hash_unique unique (token_hash)
);

create table if not exists public.auth_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.platform_users(id),
  event_type text not null,
  ip_address text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_users(id),
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mfa_recovery_codes_user_code_hash_unique unique (
    user_id,
    code_hash
  )
);

create table if not exists public.break_glass_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_users(id),
  label text not null,
  is_enabled boolean not null default false,
  last_used_at timestamptz,
  last_rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint break_glass_accounts_user_id_unique unique (user_id),
  constraint break_glass_accounts_label_unique unique (label)
);

drop trigger if exists set_platform_users_updated_at on public.platform_users;
create trigger set_platform_users_updated_at
before update on public.platform_users
for each row execute function public.set_updated_at();

drop trigger if exists set_user_groups_updated_at on public.user_groups;
create trigger set_user_groups_updated_at
before update on public.user_groups
for each row execute function public.set_updated_at();

drop trigger if exists set_break_glass_accounts_updated_at
  on public.break_glass_accounts;
create trigger set_break_glass_accounts_updated_at
before update on public.break_glass_accounts
for each row execute function public.set_updated_at();

create index if not exists platform_users_username_idx
  on public.platform_users(username);
create index if not exists platform_users_email_idx
  on public.platform_users(email);
create index if not exists platform_users_identity_class_idx
  on public.platform_users(identity_class);
create index if not exists platform_users_status_idx
  on public.platform_users(status);

create index if not exists user_group_memberships_user_id_idx
  on public.user_group_memberships(user_id);
create index if not exists user_group_memberships_group_id_idx
  on public.user_group_memberships(group_id);

create index if not exists group_permissions_group_id_idx
  on public.group_permissions(group_id);
create index if not exists group_permissions_permission_key_idx
  on public.group_permissions(permission_key);

create index if not exists user_sessions_user_id_idx
  on public.user_sessions(user_id);
create index if not exists user_sessions_expires_at_idx
  on public.user_sessions(expires_at);
create index if not exists user_sessions_revoked_at_idx
  on public.user_sessions(revoked_at);

create index if not exists password_reset_tokens_user_id_idx
  on public.password_reset_tokens(user_id);
create index if not exists password_reset_tokens_expires_at_idx
  on public.password_reset_tokens(expires_at);

create index if not exists auth_audit_log_user_id_idx
  on public.auth_audit_log(user_id);
create index if not exists auth_audit_log_event_type_idx
  on public.auth_audit_log(event_type);
create index if not exists auth_audit_log_created_at_idx
  on public.auth_audit_log(created_at);

create index if not exists mfa_recovery_codes_user_id_idx
  on public.mfa_recovery_codes(user_id);
create index if not exists mfa_recovery_codes_used_at_idx
  on public.mfa_recovery_codes(used_at);

create index if not exists break_glass_accounts_user_id_idx
  on public.break_glass_accounts(user_id);
create index if not exists break_glass_accounts_is_enabled_idx
  on public.break_glass_accounts(is_enabled);

alter table public.platform_users enable row level security;
alter table public.user_groups enable row level security;
alter table public.user_group_memberships enable row level security;
alter table public.group_permissions enable row level security;
alter table public.user_sessions enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.auth_audit_log enable row level security;
alter table public.mfa_recovery_codes enable row level security;
alter table public.break_glass_accounts enable row level security;

insert into public.user_groups (name, is_system_group)
values
  ('Super Admin', true),
  ('Operations Admin', true),
  ('Settlement Admin', true),
  ('Risk Admin', true),
  ('Compliance Admin', true),
  ('Support Admin', true)
on conflict (name) do update
set
  is_system_group = excluded.is_system_group,
  updated_at = now();
