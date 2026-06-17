create table if not exists public.credit_settlement_applications (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.credit_reservations(id),
  player_id uuid not null references public.accounts(id),
  ticket_id text not null,
  settlement_id text not null,
  release_amount bigint not null,
  balance_impact bigint not null default 0,
  balance_before bigint not null,
  balance_after bigint not null,
  currency text not null,
  operation_type text not null,
  idempotency_key text not null unique,
  correlation_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint credit_settlement_applications_release_amount_check check (
    release_amount > 0
  ),
  constraint credit_settlement_applications_currency_check check (
    currency ~ '^[A-Z]{3}$'
  ),
  constraint credit_settlement_applications_operation_type_check check (
    operation_type in ('PARTIAL_SETTLEMENT', 'FULL_SETTLEMENT')
  )
);

create index if not exists credit_settlement_applications_reservation_id_idx
  on public.credit_settlement_applications(reservation_id);

create index if not exists credit_settlement_applications_player_id_idx
  on public.credit_settlement_applications(player_id);

create index if not exists credit_settlement_applications_ticket_id_idx
  on public.credit_settlement_applications(ticket_id);

create index if not exists credit_settlement_applications_settlement_id_idx
  on public.credit_settlement_applications(settlement_id);

create index if not exists credit_settlement_applications_correlation_id_idx
  on public.credit_settlement_applications(correlation_id);

create index if not exists credit_settlement_applications_created_at_idx
  on public.credit_settlement_applications(created_at);

alter table public.credit_settlement_applications enable row level security;

create or replace function public.apply_credit_settlement(
  p_reservation_id uuid,
  p_ticket_id text,
  p_settlement_id text,
  p_release_amount bigint,
  p_balance_impact bigint,
  p_currency text,
  p_idempotency_key text,
  p_correlation_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.credit_settlement_applications%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_wallet public.financial_wallets%rowtype;
  v_next_remaining bigint;
  v_next_status text;
  v_balance_before bigint;
  v_balance_after bigint;
begin
  if p_release_amount is null or p_release_amount <= 0 then
    raise exception 'Credit settlement release amount must be positive.';
  end if;

  if p_balance_impact is null then
    raise exception 'Credit settlement balance impact is required.';
  end if;

  if p_ticket_id is null or btrim(p_ticket_id) = '' then
    raise exception 'Credit settlement ticket id is required.';
  end if;

  if p_settlement_id is null or btrim(p_settlement_id) = '' then
    raise exception 'Credit settlement id is required.';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'Credit settlement idempotency key is required.';
  end if;

  if p_currency is null or btrim(p_currency) !~ '^[A-Z]{3}$' then
    raise exception 'Credit settlement currency is invalid.';
  end if;

  select *
    into v_application
  from public.credit_settlement_applications
  where idempotency_key = btrim(p_idempotency_key);

  if found then
    select *
      into v_reservation
    from public.credit_reservations
    where id = v_application.reservation_id;

    return jsonb_build_object(
      'applicationId', v_application.id,
      'reservationId', v_reservation.id,
      'playerId', v_reservation.player_id,
      'ticketId', v_reservation.ticket_id,
      'settlementId', v_application.settlement_id,
      'releaseAmount', v_application.release_amount,
      'balanceImpact', v_application.balance_impact,
      'balanceBefore', v_application.balance_before,
      'balanceAfter', v_application.balance_after,
      'currency', v_application.currency,
      'operationType', v_application.operation_type,
      'status', v_reservation.status,
      'releasedAmount', v_reservation.released_amount,
      'settledAmount', v_reservation.settled_amount,
      'remainingExposure', v_reservation.remaining_exposure,
      'idempotencyKey', v_application.idempotency_key,
      'correlationId', v_application.correlation_id,
      'createdAt', v_application.created_at
    );
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
    raise exception 'Credit reservation cannot be settled.';
  end if;

  if btrim(p_ticket_id) <> v_reservation.ticket_id then
    raise exception 'Credit settlement ticket id does not match reservation.';
  end if;

  if btrim(p_currency) <> v_reservation.currency then
    raise exception 'Credit settlement currency does not match reservation.';
  end if;

  if p_release_amount > v_reservation.remaining_exposure then
    raise exception 'Credit settlement release exceeds remaining exposure.';
  end if;

  select *
    into v_wallet
  from public.financial_wallets
  where account_id = v_reservation.player_id
    and wallet_type = 'CREDIT'
  for update;

  if not found then
    raise exception 'Credit wallet not found.';
  end if;

  if v_wallet.status <> 'ACTIVE' then
    raise exception 'Credit wallet is not active.';
  end if;

  if v_wallet.currency_code <> v_reservation.currency then
    raise exception 'Credit wallet currency does not match reservation.';
  end if;

  v_balance_before := coalesce(v_wallet.balance, 0)::bigint;
  v_balance_after := v_balance_before + p_balance_impact;
  v_next_remaining := v_reservation.remaining_exposure - p_release_amount;
  v_next_status := case
    when v_next_remaining = 0 then 'SETTLED'
    else 'PARTIALLY_RELEASED'
  end;

  insert into public.credit_settlement_applications (
    reservation_id,
    player_id,
    ticket_id,
    settlement_id,
    release_amount,
    balance_impact,
    balance_before,
    balance_after,
    currency,
    operation_type,
    idempotency_key,
    correlation_id,
    metadata
  )
  values (
    v_reservation.id,
    v_reservation.player_id,
    v_reservation.ticket_id,
    btrim(p_settlement_id),
    p_release_amount,
    p_balance_impact,
    v_balance_before,
    v_balance_after,
    v_reservation.currency,
    case when v_next_remaining = 0 then 'FULL_SETTLEMENT' else 'PARTIAL_SETTLEMENT' end,
    btrim(p_idempotency_key),
    p_correlation_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning *
    into v_application;

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
    'settlement',
    jsonb_build_object(
      'settlementId', btrim(p_settlement_id),
      'applicationId', v_application.id,
      'balanceImpact', p_balance_impact
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  update public.financial_wallets
    set balance = v_balance_after
  where id = v_wallet.id;

  update public.credit_reservations
    set released_amount = released_amount + p_release_amount,
        settled_amount = settled_amount + p_release_amount,
        remaining_exposure = v_next_remaining,
        status = v_next_status,
        released_at = case
          when v_next_remaining = 0 then now()
          else released_at
        end,
        settled_at = case
          when v_next_remaining = 0 then now()
          else settled_at
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
    'credit.settlement.applied',
    'credit_reservation',
    v_reservation.id::text,
    jsonb_build_object(
      'applicationId', v_application.id,
      'reservationId', v_reservation.id,
      'playerId', v_reservation.player_id,
      'ticketId', v_reservation.ticket_id,
      'settlementId', v_application.settlement_id,
      'releaseAmount', v_application.release_amount,
      'balanceImpact', v_application.balance_impact,
      'currency', v_application.currency,
      'operationType', v_application.operation_type,
      'remainingExposure', v_reservation.remaining_exposure,
      'status', v_reservation.status
    ),
    'PENDING',
    p_correlation_id
  );

  if p_balance_impact <> 0 then
    insert into public.outbox_events (
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      status,
      correlation_id
    )
    values (
      'credit.balance.updated',
      'credit_wallet',
      v_wallet.id::text,
      jsonb_build_object(
        'walletId', v_wallet.id,
        'playerId', v_reservation.player_id,
        'reservationId', v_reservation.id,
        'ticketId', v_reservation.ticket_id,
        'settlementId', v_application.settlement_id,
        'balanceImpact', v_application.balance_impact,
        'balanceBefore', v_application.balance_before,
        'balanceAfter', v_application.balance_after,
        'currency', v_application.currency
      ),
      'PENDING',
      p_correlation_id
    );
  end if;

  return jsonb_build_object(
    'applicationId', v_application.id,
    'reservationId', v_reservation.id,
    'playerId', v_reservation.player_id,
    'ticketId', v_reservation.ticket_id,
    'settlementId', v_application.settlement_id,
    'releaseAmount', v_application.release_amount,
    'balanceImpact', v_application.balance_impact,
    'balanceBefore', v_application.balance_before,
    'balanceAfter', v_application.balance_after,
    'currency', v_application.currency,
    'operationType', v_application.operation_type,
    'status', v_reservation.status,
    'releasedAmount', v_reservation.released_amount,
    'settledAmount', v_reservation.settled_amount,
    'remainingExposure', v_reservation.remaining_exposure,
    'idempotencyKey', v_application.idempotency_key,
    'correlationId', v_application.correlation_id,
    'createdAt', v_application.created_at
  );
end;
$$;
