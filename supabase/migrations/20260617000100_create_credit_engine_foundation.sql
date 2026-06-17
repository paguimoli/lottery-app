create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  ticket_id text not null,
  amount bigint not null,
  currency text not null,
  status text not null,
  reserved_amount bigint not null,
  released_amount bigint not null default 0,
  settled_amount bigint not null default 0,
  remaining_exposure bigint not null,
  idempotency_key text not null unique,
  correlation_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz null,
  settled_at timestamptz null,
  cancelled_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  constraint credit_reservations_status_check check (
    status in (
      'RESERVED',
      'PARTIALLY_RELEASED',
      'RELEASED',
      'SETTLED',
      'CANCELLED',
      'FAILED'
    )
  ),
  constraint credit_reservations_amount_positive_check check (amount > 0),
  constraint credit_reservations_reserved_amount_positive_check check (reserved_amount > 0),
  constraint credit_reservations_released_amount_nonnegative_check check (released_amount >= 0),
  constraint credit_reservations_settled_amount_nonnegative_check check (settled_amount >= 0),
  constraint credit_reservations_remaining_exposure_nonnegative_check check (remaining_exposure >= 0),
  constraint credit_reservations_currency_check check (currency ~ '^[A-Z]{3}$')
);

create index if not exists credit_reservations_player_id_idx
  on public.credit_reservations(player_id);
create index if not exists credit_reservations_ticket_id_idx
  on public.credit_reservations(ticket_id);
create index if not exists credit_reservations_status_idx
  on public.credit_reservations(status);
create index if not exists credit_reservations_correlation_id_idx
  on public.credit_reservations(correlation_id);
create index if not exists credit_reservations_created_at_idx
  on public.credit_reservations(created_at);

drop trigger if exists set_credit_reservations_updated_at on public.credit_reservations;

create trigger set_credit_reservations_updated_at
  before update on public.credit_reservations
  for each row
  execute function public.set_updated_at();

alter table public.credit_reservations enable row level security;

create table if not exists public.credit_reservation_releases (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.credit_reservations(id),
  ticket_id text not null,
  release_amount bigint not null,
  idempotency_key text not null unique,
  correlation_id text null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint credit_reservation_releases_amount_positive_check check (release_amount > 0)
);

create index if not exists credit_reservation_releases_reservation_id_idx
  on public.credit_reservation_releases(reservation_id);
create index if not exists credit_reservation_releases_ticket_id_idx
  on public.credit_reservation_releases(ticket_id);
create index if not exists credit_reservation_releases_correlation_id_idx
  on public.credit_reservation_releases(correlation_id);
create index if not exists credit_reservation_releases_created_at_idx
  on public.credit_reservation_releases(created_at);

alter table public.credit_reservation_releases enable row level security;

do $$
begin
  if to_regclass('public.tickets') is not null then
    alter table public.tickets
      add column if not exists credit_reservation_id uuid null references public.credit_reservations(id);

    create index if not exists tickets_credit_reservation_id_idx
      on public.tickets(credit_reservation_id);
  end if;
end $$;

create or replace function public.resolve_credit_player_account_id(
  p_player_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_external_player_id text;
begin
  select a.id
    into v_account_id
  from public.accounts a
  where a.id = p_player_id
    and a.account_type = 'PLAYER'
  limit 1;

  if v_account_id is not null then
    return v_account_id;
  end if;

  select pp.account_id
    into v_account_id
  from public.player_profiles pp
  where pp.id = p_player_id
  limit 1;

  if v_account_id is not null then
    return v_account_id;
  end if;

  if to_regclass('public.players') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'players'
        and column_name = 'account_id'
    ) then
      execute 'select account_id from public.players where id = $1 limit 1'
        into v_account_id
        using p_player_id;

      if v_account_id is not null then
        return v_account_id;
      end if;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'players'
        and column_name = 'external_player_id'
    ) then
      execute 'select external_player_id from public.players where id = $1 limit 1'
        into v_external_player_id
        using p_player_id;

      if v_external_player_id is not null then
        select pp.account_id
          into v_account_id
        from public.player_profiles pp
        where pp.external_player_id = v_external_player_id
        limit 1;

        if v_account_id is not null then
          return v_account_id;
        end if;
      end if;
    end if;
  end if;

  raise exception 'Player not found.';
end;
$$;

create or replace function public.get_player_credit_summary(
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_wallet public.financial_wallets%rowtype;
  v_pending_exposure bigint;
  v_credit_limit bigint;
  v_balance bigint;
  v_available_credit bigint;
begin
  v_account_id := public.resolve_credit_player_account_id(p_player_id);

  select *
    into v_wallet
  from public.financial_wallets
  where account_id = v_account_id
    and wallet_type = 'CREDIT';

  if not found then
    raise exception 'Credit wallet not found.';
  end if;

  select coalesce(sum(remaining_exposure), 0)::bigint
    into v_pending_exposure
  from public.credit_reservations
  where player_id = v_account_id
    and status in ('RESERVED', 'PARTIALLY_RELEASED');

  v_credit_limit := coalesce(v_wallet.credit_limit, 0)::bigint;
  v_balance := coalesce(v_wallet.balance, 0)::bigint;
  v_available_credit := v_credit_limit + v_balance - v_pending_exposure;

  return jsonb_build_object(
    'playerId', v_account_id,
    'walletId', v_wallet.id,
    'creditLimit', v_credit_limit,
    'balance', v_balance,
    'pendingExposure', v_pending_exposure,
    'availableCredit', v_available_credit,
    'currency', v_wallet.currency_code
  );
end;
$$;

create or replace function public.reserve_credit_exposure(
  p_player_id uuid,
  p_ticket_id text,
  p_amount bigint,
  p_currency text,
  p_idempotency_key text,
  p_correlation_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.credit_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.credit_reservations%rowtype;
  v_account_id uuid;
  v_wallet public.financial_wallets%rowtype;
  v_pending_exposure bigint;
  v_credit_limit bigint;
  v_balance bigint;
  v_available_credit bigint;
  v_reservation public.credit_reservations%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Credit reservation amount must be positive.';
  end if;

  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'Credit reservation currency is invalid.';
  end if;

  if p_ticket_id is null or btrim(p_ticket_id) = '' then
    raise exception 'Credit reservation ticket id is required.';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'Credit reservation idempotency key is required.';
  end if;

  select *
    into v_existing
  from public.credit_reservations
  where idempotency_key = p_idempotency_key;

  if found then
    return v_existing;
  end if;

  v_account_id := public.resolve_credit_player_account_id(p_player_id);

  select *
    into v_wallet
  from public.financial_wallets
  where account_id = v_account_id
    and wallet_type = 'CREDIT'
  for update;

  if not found then
    raise exception 'Credit wallet not found.';
  end if;

  if v_wallet.status <> 'ACTIVE' then
    raise exception 'Credit wallet is not active.';
  end if;

  if v_wallet.currency_code <> p_currency then
    raise exception 'Credit reservation currency does not match wallet currency.';
  end if;

  select coalesce(sum(remaining_exposure), 0)::bigint
    into v_pending_exposure
  from public.credit_reservations
  where player_id = v_account_id
    and status in ('RESERVED', 'PARTIALLY_RELEASED');

  v_credit_limit := coalesce(v_wallet.credit_limit, 0)::bigint;
  v_balance := coalesce(v_wallet.balance, 0)::bigint;
  v_available_credit := v_credit_limit + v_balance - v_pending_exposure;

  if v_available_credit < p_amount then
    insert into public.outbox_events (
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      status,
      correlation_id
    )
    values (
      'credit.reservation.rejected',
      'credit_reservation',
      p_ticket_id,
      jsonb_build_object(
        'playerId', v_account_id,
        'ticketId', p_ticket_id,
        'requestedAmount', p_amount,
        'currency', p_currency,
        'availableCredit', v_available_credit,
        'reason', 'CREDIT_INSUFFICIENT_AVAILABLE'
      ),
      'PENDING',
      p_correlation_id
    );

    raise exception 'Insufficient available credit.';
  end if;

  insert into public.credit_reservations (
    player_id,
    ticket_id,
    amount,
    currency,
    status,
    reserved_amount,
    released_amount,
    settled_amount,
    remaining_exposure,
    idempotency_key,
    correlation_id,
    metadata
  )
  values (
    v_account_id,
    btrim(p_ticket_id),
    p_amount,
    p_currency,
    'RESERVED',
    p_amount,
    0,
    0,
    p_amount,
    btrim(p_idempotency_key),
    p_correlation_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning *
    into v_reservation;

  insert into public.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    status,
    correlation_id
  )
  values (
    'credit.exposure.reserved',
    'credit_reservation',
    v_reservation.id::text,
    jsonb_build_object(
      'reservationId', v_reservation.id,
      'playerId', v_account_id,
      'ticketId', v_reservation.ticket_id,
      'amount', v_reservation.amount,
      'currency', v_reservation.currency,
      'remainingExposure', v_reservation.remaining_exposure
    ),
    'PENDING',
    p_correlation_id
  );

  return v_reservation;
end;
$$;

create or replace function public.release_credit_exposure(
  p_reservation_id uuid,
  p_ticket_id text,
  p_release_amount bigint,
  p_idempotency_key text,
  p_correlation_id text default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.credit_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_release public.credit_reservation_releases%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_next_remaining bigint;
  v_next_status text;
begin
  if p_release_amount is null or p_release_amount <= 0 then
    raise exception 'Credit release amount must be positive.';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'Credit release idempotency key is required.';
  end if;

  select *
    into v_existing_release
  from public.credit_reservation_releases
  where idempotency_key = p_idempotency_key;

  if found then
    select *
      into v_reservation
    from public.credit_reservations
    where id = v_existing_release.reservation_id;

    return v_reservation;
  end if;

  select *
    into v_reservation
  from public.credit_reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Credit reservation not found.';
  end if;

  if v_reservation.status not in ('RESERVED', 'PARTIALLY_RELEASED') then
    raise exception 'Credit reservation cannot be released.';
  end if;

  if p_ticket_id is not null and btrim(p_ticket_id) <> v_reservation.ticket_id then
    raise exception 'Credit release ticket id does not match reservation.';
  end if;

  if p_release_amount > v_reservation.remaining_exposure then
    raise exception 'Credit release exceeds remaining exposure.';
  end if;

  insert into public.credit_reservation_releases (
    reservation_id,
    ticket_id,
    release_amount,
    idempotency_key,
    correlation_id,
    reason,
    metadata
  )
  values (
    v_reservation.id,
    v_reservation.ticket_id,
    p_release_amount,
    btrim(p_idempotency_key),
    p_correlation_id,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb)
  );

  v_next_remaining := v_reservation.remaining_exposure - p_release_amount;
  v_next_status := case
    when v_next_remaining = 0 then 'RELEASED'
    else 'PARTIALLY_RELEASED'
  end;

  update public.credit_reservations
    set released_amount = released_amount + p_release_amount,
        remaining_exposure = v_next_remaining,
        status = v_next_status,
        released_at = case
          when v_next_remaining = 0 then now()
          else released_at
        end
  where id = v_reservation.id
  returning *
    into v_reservation;

  insert into public.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    status,
    correlation_id
  )
  values (
    'credit.exposure.released',
    'credit_reservation',
    v_reservation.id::text,
    jsonb_build_object(
      'reservationId', v_reservation.id,
      'playerId', v_reservation.player_id,
      'ticketId', v_reservation.ticket_id,
      'releasedAmount', p_release_amount,
      'currency', v_reservation.currency,
      'remainingExposure', v_reservation.remaining_exposure,
      'status', v_reservation.status
    ),
    'PENDING',
    p_correlation_id
  );

  return v_reservation;
end;
$$;

create or replace function public.cancel_credit_reservation(
  p_reservation_id uuid,
  p_correlation_id text default null,
  p_reason text default null
)
returns public.credit_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.credit_reservations%rowtype;
begin
  select *
    into v_reservation
  from public.credit_reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Credit reservation not found.';
  end if;

  if v_reservation.status in ('RELEASED', 'SETTLED', 'CANCELLED') then
    return v_reservation;
  end if;

  update public.credit_reservations
    set status = 'CANCELLED',
        remaining_exposure = 0,
        cancelled_at = now(),
        metadata = metadata || jsonb_build_object(
          'cancelReason', p_reason,
          'cancelCorrelationId', p_correlation_id
        )
  where id = v_reservation.id
  returning *
    into v_reservation;

  return v_reservation;
end;
$$;

create or replace function public.place_ticket_with_wallet_debit(
  p_organization_id uuid,
  p_player_id uuid,
  p_drawing_id uuid,
  p_external_ticket_id text,
  p_source_type text default 'api',
  p_currency text default 'USD',
  p_total_amount bigint default 0,
  p_legs jsonb default '[]'::jsonb,
  p_idempotency_key text default null,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_ticket_id uuid;
  v_reservation public.credit_reservations%rowtype;
  v_ticket_id uuid;
  v_idempotency_key text;
  v_leg jsonb;
begin
  if p_total_amount is null or p_total_amount <= 0 then
    return jsonb_build_object(
      'accepted', false,
      'error', 'Ticket amount must be positive.'
    );
  end if;

  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    return jsonb_build_object(
      'accepted', false,
      'error', 'Ticket currency is invalid.'
    );
  end if;

  select id
    into v_existing_ticket_id
  from public.tickets
  where organization_id = p_organization_id
    and external_ticket_id = p_external_ticket_id
  limit 1;

  if v_existing_ticket_id is not null then
    return jsonb_build_object(
      'accepted', true,
      'duplicate', true,
      'ticketId', v_existing_ticket_id,
      'externalTicketId', p_external_ticket_id
    );
  end if;

  v_ticket_id := gen_random_uuid();
  v_idempotency_key := coalesce(
    nullif(btrim(p_idempotency_key), ''),
    'ticket:' || p_organization_id::text || ':' || p_external_ticket_id
  );

  v_reservation := public.reserve_credit_exposure(
    p_player_id => p_player_id,
    p_ticket_id => v_ticket_id::text,
    p_amount => p_total_amount,
    p_currency => p_currency,
    p_idempotency_key => v_idempotency_key,
    p_correlation_id => p_correlation_id,
    p_metadata => jsonb_build_object(
      'source', 'ticket_intake',
      'externalTicketId', p_external_ticket_id,
      'organizationId', p_organization_id,
      'drawingId', p_drawing_id
    )
  );

  insert into public.tickets (
    id,
    organization_id,
    player_id,
    drawing_id,
    external_ticket_id,
    source_type,
    currency,
    total_amount,
    status,
    credit_reservation_id,
    created_at
  )
  values (
    v_ticket_id,
    p_organization_id,
    p_player_id,
    p_drawing_id,
    p_external_ticket_id,
    coalesce(nullif(btrim(p_source_type), ''), 'api'),
    p_currency,
    p_total_amount,
    'accepted',
    v_reservation.id,
    now()
  );

  if to_regclass('public.ticket_legs') is not null then
    for v_leg in select * from jsonb_array_elements(coalesce(p_legs, '[]'::jsonb))
    loop
      insert into public.ticket_legs (
        ticket_id,
        bet_type,
        numbers,
        amount,
        stake_mode,
        box_way_count,
        spot_count,
        bullseye_enabled,
        selection_method,
        created_at
      )
      values (
        v_ticket_id,
        v_leg ->> 'betType',
        v_leg ->> 'numbers',
        coalesce((v_leg ->> 'amount')::bigint, 0),
        v_leg ->> 'stakeMode',
        nullif(v_leg ->> 'boxWayCount', '')::integer,
        nullif(v_leg ->> 'spotCount', '')::integer,
        coalesce((v_leg ->> 'bullseyeEnabled')::boolean, false),
        v_leg ->> 'selectionMethod',
        now()
      );
    end loop;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'ticketId', v_ticket_id,
    'externalTicketId', p_external_ticket_id,
    'creditReservationId', v_reservation.id,
    'reservedAmount', v_reservation.amount,
    'currency', v_reservation.currency
  );
exception
  when others then
    return jsonb_build_object(
      'accepted', false,
      'error', sqlerrm
    );
end;
$$;
