import type { AuditEvent } from "./audit.types";
import { supabaseServerAdmin } from "@/src/lib/supabase/server-admin-client";
import type {
  FinancialAuthAuditEvent,
  FinancialAuditRecord,
  FinancialOutboxAuditEvent,
} from "./audit.types";

export function saveAuditEvent(events: AuditEvent[], event: AuditEvent) {
  return [...events, event];
}

export function saveAuditEvents(events: AuditEvent[], newEvents: AuditEvent[]) {
  return [...events, ...newEvents];
}

export function findAuditEventsByEntity({
  events,
  entityType,
  entityId,
}: {
  events: AuditEvent[];
  entityType: string;
  entityId: string;
}) {
  return events.filter(
    (event) => event.entityType === entityType && event.entityId === entityId
  );
}

export function findAuditEventsByAction(events: AuditEvent[], action: string) {
  return events.filter((event) => event.action === action);
}

export function findAuditEventsByActor({
  events,
  actorId,
}: {
  events: AuditEvent[];
  actorId: string;
}) {
  return events.filter((event) => event.actorId === actorId);
}

type OutboxRow = {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload?: Record<string, unknown> | null;
  status: string;
  correlation_id?: string | null;
  created_at: string;
  published_at?: string | null;
};

type AuthAuditRow = {
  id: string;
  user_id?: string | null;
  event_type: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export class FinancialAuditRepositoryError extends Error {
  constructor(message = "Financial audit persistence operation failed.") {
    super(message);
    this.name = "FinancialAuditRepositoryError";
  }
}

function mapOutboxRow(row: OutboxRow): FinancialOutboxAuditEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: row.payload ?? {},
    status: row.status,
    correlationId: row.correlation_id ?? null,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? null,
  };
}

function mapAuthAuditRow(row: AuthAuditRow): FinancialAuthAuditEvent {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    eventType: row.event_type,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function asRecord(row: unknown): Record<string, unknown> {
  return typeof row === "object" && row !== null
    ? (row as Record<string, unknown>)
    : {};
}

function toAuditRecord(table: string, row: unknown): FinancialAuditRecord {
  const record = asRecord(row);

  return {
    table,
    id: String(record.id ?? ""),
    record,
  };
}

function isMissingRelationError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.message?.includes("does not exist") ||
    error.message?.includes("column")
  );
}

async function selectMaybe<T>(
  table: string,
  build: (
    query: ReturnType<typeof supabaseServerAdmin.from>
  ) => PromiseLike<{ data: T[] | null; error: { code?: string; message: string } | null }>
): Promise<T[]> {
  const result = await build(supabaseServerAdmin.from(table));

  if (result.error) {
    if (isMissingRelationError(result.error)) {
      return [];
    }

    throw new FinancialAuditRepositoryError(result.error.message);
  }

  return result.data ?? [];
}

export async function findRecordsByColumn({
  table,
  column,
  value,
  limit = 100,
}: {
  table: string;
  column: string;
  value: string;
  limit?: number;
}): Promise<FinancialAuditRecord[]> {
  const rows = await selectMaybe<Record<string, unknown>>(table, (query) =>
    query.select("*").eq(column, value).limit(limit)
  );

  return rows.map((row) => toAuditRecord(table, row));
}

export async function findRecordsByWeek({
  table,
  weekStart,
  weekEnd,
  currency,
  limit = 500,
}: {
  table: string;
  weekStart: string;
  weekEnd: string;
  currency?: string | null;
  limit?: number;
}): Promise<FinancialAuditRecord[]> {
  let query = supabaseServerAdmin
    .from(table)
    .select("*")
    .eq("week_start", weekStart)
    .eq("week_end", weekEnd)
    .limit(limit);

  if (currency) {
    query = query.eq("currency", currency);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }

    throw new FinancialAuditRepositoryError(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    toAuditRecord(table, row)
  );
}

export async function findOutboxEventsByCorrelationId(
  correlationId: string
): Promise<FinancialOutboxAuditEvent[]> {
  const { data, error } = await supabaseServerAdmin
    .from("outbox_events")
    .select(
      "id, event_type, aggregate_type, aggregate_id, payload, status, correlation_id, created_at, published_at"
    )
    .eq("correlation_id", correlationId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new FinancialAuditRepositoryError(error.message);
  }

  return ((data ?? []) as OutboxRow[]).map(mapOutboxRow);
}

export async function findOutboxEventsByAggregate({
  aggregateType,
  aggregateId,
}: {
  aggregateType: string;
  aggregateId: string;
}): Promise<FinancialOutboxAuditEvent[]> {
  const { data, error } = await supabaseServerAdmin
    .from("outbox_events")
    .select(
      "id, event_type, aggregate_type, aggregate_id, payload, status, correlation_id, created_at, published_at"
    )
    .eq("aggregate_type", aggregateType)
    .eq("aggregate_id", aggregateId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new FinancialAuditRepositoryError(error.message);
  }

  return ((data ?? []) as OutboxRow[]).map(mapOutboxRow);
}

export async function findOutboxEventsByPayloadValue({
  key,
  value,
}: {
  key: string;
  value: string;
}): Promise<FinancialOutboxAuditEvent[]> {
  const { data, error } = await supabaseServerAdmin
    .from("outbox_events")
    .select(
      "id, event_type, aggregate_type, aggregate_id, payload, status, correlation_id, created_at, published_at"
    )
    .filter(`payload->>${key}`, "eq", value)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new FinancialAuditRepositoryError(error.message);
  }

  return ((data ?? []) as OutboxRow[]).map(mapOutboxRow);
}

export async function findAuthAuditEventsByMetadataValue({
  key,
  value,
}: {
  key: string;
  value: string;
}): Promise<FinancialAuthAuditEvent[]> {
  const { data, error } = await supabaseServerAdmin
    .from("auth_audit_log")
    .select("id, user_id, event_type, metadata, created_at")
    .filter(`metadata->>${key}`, "eq", value)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new FinancialAuditRepositoryError(error.message);
  }

  return ((data ?? []) as AuthAuditRow[]).map(mapAuthAuditRow);
}
