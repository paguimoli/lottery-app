import type { AuditEvent, CreateAuditEventInput } from "./audit.types";
import { attachIntegrityHash } from "../integrity/integrity.helpers";
import {
  findAuthAuditEventsByMetadataValue,
  findOutboxEventsByAggregate,
  findOutboxEventsByCorrelationId,
  findOutboxEventsByPayloadValue,
  findRecordsByColumn,
  findRecordsByWeek,
} from "./audit.repository";
import type {
  FinancialAuditGap,
  FinancialAuditRecord,
  FinancialAuditTrail,
  FinancialOutboxAuditEvent,
} from "./audit.types";

export function generateAuditEventId() {
  return `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildAuditEvent(input: CreateAuditEventInput): AuditEvent {
  const event: AuditEvent = {
    id: generateAuditEventId(),
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorType: input.actorType,
    actorId: input.actorId,
    oldValue: input.oldValue,
    newValue: input.newValue,
    reasonCode: input.reasonCode || null,
    approvalId: input.approvalId || null,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };

  return attachIntegrityHash(event, "audit_event", event.id);
}

export function createAuditEvent(input: CreateAuditEventInput) {
  return buildAuditEvent(input);
}

export function createAuditEvents(inputs: CreateAuditEventInput[]) {
  return inputs.map((input) => createAuditEvent(input));
}

export function sortAuditEventsChronologically(events: AuditEvent[]) {
  return [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function getAuditTimeline(events: AuditEvent[]) {
  return sortAuditEventsChronologically(events);
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRecordCorrelationId(record: FinancialAuditRecord) {
  return (
    getString(record.record.correlation_id) ??
    getString(record.record.correlationId) ??
    (typeof record.record.metadata === "object" && record.record.metadata
      ? getString((record.record.metadata as Record<string, unknown>).correlationId)
      : null)
  );
}

function getOutboxCorrelationIds(events: FinancialOutboxAuditEvent[]) {
  return events.flatMap((event) =>
    event.correlationId ? [event.correlationId] : []
  );
}

function mergeRecords(records: FinancialAuditRecord[]) {
  const seen = new Set<string>();
  const merged: FinancialAuditRecord[] = [];

  for (const record of records) {
    const key = `${record.table}:${record.id}`;

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(record);
    }
  }

  return merged;
}

function mergeOutbox(events: FinancialOutboxAuditEvent[]) {
  const seen = new Set<string>();
  const merged: FinancialOutboxAuditEvent[] = [];

  for (const event of events) {
    if (!seen.has(event.id)) {
      seen.add(event.id);
      merged.push(event);
    }
  }

  return merged.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function gap(input: FinancialAuditGap): FinancialAuditGap {
  return input;
}

function buildTrail({
  queryType,
  queryId,
  sourceRecords,
  outboxEvents,
  authAuditEvents,
  gaps,
  requireSource = true,
}: Omit<FinancialAuditTrail, "correlationIds" | "reconstructable"> & {
  requireSource?: boolean;
}): FinancialAuditTrail {
  const correlationIds = unique([
    ...sourceRecords.flatMap((record) => {
      const correlationId = getRecordCorrelationId(record);

      return correlationId ? [correlationId] : [];
    }),
    ...getOutboxCorrelationIds(outboxEvents),
  ]);
  const hasSource = sourceRecords.length > 0;
  const hasOutbox = outboxEvents.length > 0;
  const hasCorrelation = correlationIds.length > 0;
  const derivedGaps: FinancialAuditGap[] = [...gaps];

  if (requireSource && !hasSource) {
    derivedGaps.push(
      gap({
        severity: "FAIL",
        code: "SOURCE_RECORD_MISSING",
        message: "No source record was found for this audit query.",
      })
    );
  }

  if (!hasOutbox) {
    derivedGaps.push(
      gap({
        severity: "WARNING",
        code: "OUTBOX_EVENT_MISSING",
        message: "No outbox event was found for this audit query.",
      })
    );
  }

  if (!hasCorrelation) {
    derivedGaps.push(
      gap({
        severity: "WARNING",
        code: "CORRELATION_ID_MISSING",
        message: "No correlation id was found in source records or outbox events.",
      })
    );
  }

  if (authAuditEvents.length === 0) {
    derivedGaps.push(
      gap({
        severity: "INFO",
        code: "AUTH_AUDIT_EVENT_NOT_FOUND",
        message:
          "No auth audit event was found for this query. Financial workflows may rely on source rows and outbox events instead.",
      })
    );
  }

  return {
    queryType,
    queryId,
    correlationIds,
    sourceRecords: mergeRecords(sourceRecords),
    authAuditEvents,
    outboxEvents: mergeOutbox(outboxEvents),
    gaps: derivedGaps,
    reconstructable:
      (!requireSource || hasSource) &&
      hasOutbox &&
      hasCorrelation &&
      !derivedGaps.some((item) => item.severity === "FAIL"),
  };
}

async function expandByCorrelationIds(correlationIds: string[]) {
  const outbox = (
    await Promise.all(correlationIds.map((id) => findOutboxEventsByCorrelationId(id)))
  ).flat();

  return outbox;
}

export async function getAuditTrailByCorrelationId(
  correlationId: string
): Promise<FinancialAuditTrail> {
  const [outboxEvents, authAuditEvents] = await Promise.all([
    findOutboxEventsByCorrelationId(correlationId),
    findAuthAuditEventsByMetadataValue({ key: "correlationId", value: correlationId }),
  ]);

  return buildTrail({
    queryType: "correlation",
    queryId: correlationId,
    sourceRecords: [],
    outboxEvents,
    authAuditEvents,
    gaps: [],
    requireSource: false,
  });
}

export async function getAuditTrailByTicketId(
  ticketId: string
): Promise<FinancialAuditTrail> {
  const [
    tickets,
    reservations,
    releases,
    settlements,
    outboxByTicket,
    authAuditEvents,
  ] = await Promise.all([
    findRecordsByColumn({ table: "tickets", column: "id", value: ticketId }),
    findRecordsByColumn({
      table: "credit_reservations",
      column: "ticket_id",
      value: ticketId,
    }),
    findRecordsByColumn({
      table: "credit_reservation_releases",
      column: "ticket_id",
      value: ticketId,
    }),
    findRecordsByColumn({
      table: "credit_settlement_applications",
      column: "ticket_id",
      value: ticketId,
    }),
    findOutboxEventsByPayloadValue({ key: "ticketId", value: ticketId }),
    findAuthAuditEventsByMetadataValue({ key: "ticketId", value: ticketId }),
  ]);
  const sourceRecords = [...tickets, ...reservations, ...releases, ...settlements];
  const outboxEvents = mergeOutbox([
    ...outboxByTicket,
    ...(await expandByCorrelationIds(
      unique(sourceRecords.flatMap((record) => getRecordCorrelationId(record) ?? []))
    )),
  ]);
  const hasTicketAccepted = outboxEvents.some(
    (event) => event.eventType === "ticket.accepted"
  );

  return buildTrail({
    queryType: "ticket",
    queryId: ticketId,
    sourceRecords,
    outboxEvents,
    authAuditEvents,
    gaps: hasTicketAccepted
      ? []
      : [
          gap({
            severity: "WARNING",
            code: "TICKET_ACCEPTED_OUTBOX_MISSING",
            message:
              "Ticket source exists, but no dedicated ticket.accepted outbox event was found.",
            entityType: "ticket",
            entityId: ticketId,
          }),
        ],
  });
}

export async function getAuditTrailByReservationId(
  reservationId: string
): Promise<FinancialAuditTrail> {
  const [reservations, releases, settlements, outboxByAggregate, authAuditEvents] =
    await Promise.all([
      findRecordsByColumn({
        table: "credit_reservations",
        column: "id",
        value: reservationId,
      }),
      findRecordsByColumn({
        table: "credit_reservation_releases",
        column: "reservation_id",
        value: reservationId,
      }),
      findRecordsByColumn({
        table: "credit_settlement_applications",
        column: "reservation_id",
        value: reservationId,
      }),
      findOutboxEventsByAggregate({
        aggregateType: "credit_reservation",
        aggregateId: reservationId,
      }),
      findAuthAuditEventsByMetadataValue({
        key: "reservationId",
        value: reservationId,
      }),
    ]);
  const sourceRecords = [...reservations, ...releases, ...settlements];
  const outboxEvents = mergeOutbox([
    ...outboxByAggregate,
    ...(await expandByCorrelationIds(
      unique(sourceRecords.flatMap((record) => getRecordCorrelationId(record) ?? []))
    )),
  ]);

  return buildTrail({
    queryType: "reservation",
    queryId: reservationId,
    sourceRecords,
    outboxEvents,
    authAuditEvents,
    gaps: [],
  });
}

export async function getAuditTrailByLedgerTransactionId(
  transactionId: string
): Promise<FinancialAuditTrail> {
  const [ledgerEntries, outboxEvents, authAuditEvents] = await Promise.all([
    findRecordsByColumn({
      table: "financial_ledger_entries",
      column: "id",
      value: transactionId,
    }),
    findOutboxEventsByPayloadValue({ key: "ledgerEntryId", value: transactionId }),
    findAuthAuditEventsByMetadataValue({ key: "ledgerEntryId", value: transactionId }),
  ]);

  return buildTrail({
    queryType: "ledger",
    queryId: transactionId,
    sourceRecords: ledgerEntries,
    outboxEvents,
    authAuditEvents,
    gaps: [],
  });
}

export async function getAuditTrailByCommissionRunId(
  runId: string
): Promise<FinancialAuditTrail> {
  const [runs, details, adjustments, outboxByAggregate, authAuditEvents] =
    await Promise.all([
      findRecordsByColumn({ table: "commission_runs", column: "id", value: runId }),
      findRecordsByColumn({
        table: "commission_run_details",
        column: "run_id",
        value: runId,
      }),
      findRecordsByColumn({
        table: "commission_adjustments",
        column: "run_id",
        value: runId,
      }),
      findOutboxEventsByAggregate({
        aggregateType: "commission_run",
        aggregateId: runId,
      }),
      findAuthAuditEventsByMetadataValue({ key: "runId", value: runId }),
    ]);
  const sourceRecords = [...runs, ...details, ...adjustments];
  const outboxEvents = mergeOutbox([
    ...outboxByAggregate,
    ...(await expandByCorrelationIds(
      unique(sourceRecords.flatMap((record) => getRecordCorrelationId(record) ?? []))
    )),
  ]);

  return buildTrail({
    queryType: "commission_run",
    queryId: runId,
    sourceRecords,
    outboxEvents,
    authAuditEvents,
    gaps: [],
  });
}

export async function getAuditTrailByAccountingWeek({
  weekStart,
  weekEnd,
  currency,
}: {
  weekStart: string;
  weekEnd: string;
  currency?: string | null;
}): Promise<FinancialAuditTrail> {
  const [snapshots, outboxEvents] = await Promise.all([
    findRecordsByWeek({
      table: "weekly_accounting_snapshots",
      weekStart,
      weekEnd,
      currency,
    }),
    findOutboxEventsByPayloadValue({ key: "weekStart", value: weekStart }),
  ]);
  const authAuditEvents = await findAuthAuditEventsByMetadataValue({
    key: "weekStart",
    value: weekStart,
  });

  return buildTrail({
    queryType: "accounting_week",
    queryId: `${weekStart}:${weekEnd}:${currency ?? "ALL"}`,
    sourceRecords: snapshots,
    outboxEvents,
    authAuditEvents,
    gaps: [],
  });
}
