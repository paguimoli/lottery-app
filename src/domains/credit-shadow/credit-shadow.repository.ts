import { supabaseServerAdmin } from "@/src/lib/supabase/server-admin-client";
import type {
  CreditShadowFailure,
  CreditShadowListFilters,
  CreditShadowMismatch,
  CreditShadowRun,
} from "./credit-shadow.types";

type ShadowRunRow = {
  id: string;
  correlation_id?: string | null;
  operation_type: "RESERVE" | "RELEASE" | "SETTLEMENT";
  account_id: string;
  wallet_id?: string | null;
  ticket_id?: string | null;
  reservation_id?: string | null;
  comparison_status: "MATCH" | "MISMATCH" | "NOT_COMPARED";
  shadow_amount_minor: string | number;
  monolith_amount_minor?: string | number | null;
  shadow_available_credit?: string | number | null;
  monolith_available_credit?: string | number | null;
  shadow_reserved_amount?: string | number | null;
  monolith_reserved_amount?: string | number | null;
  shadow_released_amount?: string | number | null;
  monolith_released_amount?: string | number | null;
  shadow_remaining_exposure?: string | number | null;
  monolith_remaining_exposure?: string | number | null;
  shadow_balance_impact?: string | number | null;
  monolith_balance_impact?: string | number | null;
  currency: string;
  shadow_service_version?: string | null;
  created_at: string;
};

type ShadowMismatchRow = {
  id: string;
  shadow_run_id: string;
  mismatch_type:
    | "AVAILABLE_CREDIT_MISMATCH"
    | "RESERVATION_AMOUNT_MISMATCH"
    | "EXPOSURE_MISMATCH"
    | "SETTLEMENT_CREDIT_MISMATCH"
    | "CURRENCY_MISMATCH"
    | "UNKNOWN_MISMATCH";
  field_name: string;
  monolith_value?: string | null;
  shadow_value?: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
  created_at: string;
  credit_shadow_runs?: ShadowRunRow | null;
};

type ShadowFailureRow = {
  id: string;
  correlation_id?: string | null;
  reservation_id?: string | null;
  ticket_id?: string | null;
  failure_reason: string;
  failure_type: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

const RUN_SELECT =
  "id, correlation_id, operation_type, account_id, wallet_id, ticket_id, reservation_id, comparison_status, shadow_amount_minor, monolith_amount_minor, shadow_available_credit, monolith_available_credit, shadow_reserved_amount, monolith_reserved_amount, shadow_released_amount, monolith_released_amount, shadow_remaining_exposure, monolith_remaining_exposure, shadow_balance_impact, monolith_balance_impact, currency, shadow_service_version, created_at";
const MISMATCH_SELECT = `id, shadow_run_id, mismatch_type, field_name, monolith_value, shadow_value, severity, created_at, credit_shadow_runs(${RUN_SELECT})`;
const FAILURE_SELECT =
  "id, correlation_id, reservation_id, ticket_id, failure_reason, failure_type, metadata, created_at";

export class CreditShadowRepositoryError extends Error {
  constructor(message = "Credit shadow reporting persistence operation failed.") {
    super(message);
    this.name = "CreditShadowRepositoryError";
  }
}

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;

  return Number(value);
}

function mapRun(row: ShadowRunRow | null): CreditShadowRun | null {
  if (!row) return null;

  return {
    id: row.id,
    correlationId: row.correlation_id ?? null,
    operationType: row.operation_type,
    accountId: row.account_id,
    walletId: row.wallet_id ?? null,
    ticketId: row.ticket_id ?? null,
    reservationId: row.reservation_id ?? null,
    comparisonStatus: row.comparison_status,
    shadowAmountMinor: Number(row.shadow_amount_minor),
    monolithAmountMinor: toNullableNumber(row.monolith_amount_minor),
    shadowAvailableCredit: toNullableNumber(row.shadow_available_credit),
    monolithAvailableCredit: toNullableNumber(row.monolith_available_credit),
    shadowReservedAmount: toNullableNumber(row.shadow_reserved_amount),
    monolithReservedAmount: toNullableNumber(row.monolith_reserved_amount),
    shadowReleasedAmount: toNullableNumber(row.shadow_released_amount),
    monolithReleasedAmount: toNullableNumber(row.monolith_released_amount),
    shadowRemainingExposure: toNullableNumber(row.shadow_remaining_exposure),
    monolithRemainingExposure: toNullableNumber(row.monolith_remaining_exposure),
    shadowBalanceImpact: toNullableNumber(row.shadow_balance_impact),
    monolithBalanceImpact: toNullableNumber(row.monolith_balance_impact),
    currency: row.currency,
    shadowServiceVersion: row.shadow_service_version ?? null,
    createdAt: row.created_at,
  };
}

function mapMismatch(row: ShadowMismatchRow): CreditShadowMismatch {
  return {
    id: row.id,
    shadowRunId: row.shadow_run_id,
    mismatchType: row.mismatch_type,
    fieldName: row.field_name,
    monolithValue: row.monolith_value ?? null,
    shadowValue: row.shadow_value ?? null,
    severity: row.severity,
    createdAt: row.created_at,
    run: mapRun(row.credit_shadow_runs ?? null),
  };
}

function mapFailure(row: ShadowFailureRow): CreditShadowFailure {
  return {
    id: row.id,
    correlationId: row.correlation_id ?? null,
    reservationId: row.reservation_id ?? null,
    ticketId: row.ticket_id ?? null,
    failureReason: row.failure_reason,
    failureType: row.failure_type,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function applyDateFilters<T>(query: T, filters: CreditShadowListFilters): T {
  let nextQuery = query as {
    gte(column: string, value: string): typeof nextQuery;
    lte(column: string, value: string): typeof nextQuery;
  };

  if (filters.from) nextQuery = nextQuery.gte("created_at", filters.from);
  if (filters.to) nextQuery = nextQuery.lte("created_at", filters.to);

  return nextQuery as T;
}

export async function listShadowRuns(): Promise<CreditShadowRun[]> {
  const { data, error } = await supabaseServerAdmin
    .from("credit_shadow_runs")
    .select(RUN_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new CreditShadowRepositoryError(error.message);

  return ((data ?? []) as ShadowRunRow[])
    .map(mapRun)
    .filter((run): run is CreditShadowRun => Boolean(run));
}

export async function listShadowMismatches(
  filters: CreditShadowListFilters = {}
): Promise<CreditShadowMismatch[]> {
  let query = supabaseServerAdmin
    .from("credit_shadow_mismatches")
    .select(MISMATCH_SELECT)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  query = applyDateFilters(query, filters);

  if (filters.reservationId) {
    query = query.eq("credit_shadow_runs.reservation_id", filters.reservationId);
  }
  if (filters.ticketId) {
    query = query.eq("credit_shadow_runs.ticket_id", filters.ticketId);
  }

  const { data, error } = await query;

  if (error) throw new CreditShadowRepositoryError(error.message);

  return ((data ?? []) as unknown as ShadowMismatchRow[]).map(mapMismatch);
}

export async function listShadowFailures(
  filters: CreditShadowListFilters = {}
): Promise<CreditShadowFailure[]> {
  let query = supabaseServerAdmin
    .from("credit_shadow_failures")
    .select(FAILURE_SELECT)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  query = applyDateFilters(query, filters);

  if (filters.reservationId) {
    query = query.eq("reservation_id", filters.reservationId);
  }
  if (filters.ticketId) {
    query = query.eq("ticket_id", filters.ticketId);
  }

  const { data, error } = await query;

  if (error) throw new CreditShadowRepositoryError(error.message);

  return ((data ?? []) as ShadowFailureRow[]).map(mapFailure);
}
