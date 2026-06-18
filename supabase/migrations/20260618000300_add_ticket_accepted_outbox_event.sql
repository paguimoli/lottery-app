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
  v_created_at timestamptz;
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
  v_created_at := now();
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
    v_created_at
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
        v_created_at
      );
    end loop;
  end if;

  insert into public.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    status,
    correlation_id
  )
  values (
    'ticket.accepted',
    'ticket',
    v_ticket_id::text,
    jsonb_build_object(
      'ticketId', v_ticket_id,
      'reservationId', v_reservation.id,
      'playerId', p_player_id,
      'stake', p_total_amount,
      'amount', p_total_amount,
      'currency', p_currency,
      'correlationId', p_correlation_id,
      'createdAt', v_created_at
    ),
    'PENDING',
    p_correlation_id
  );

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
