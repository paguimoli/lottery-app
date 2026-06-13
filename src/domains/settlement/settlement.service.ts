import { generateSettlementRunId } from "./settlement.helpers";
import { attachIntegrityHash } from "../integrity/integrity.helpers";
import type {
  SettlementRecord,
  SettlementRun,
  SettlementRunStatus,
} from "./settlement.types";
import type { Ticket, TicketLine } from "../tickets/ticket.types";

export function getSettlementRecordsForRun(
  records: SettlementRecord[],
  settlementRunId: string
) {
  return records.filter((record) => record.settlementRunId === settlementRunId);
}

export function getSettlementRecordsForTicket(
  records: SettlementRecord[],
  ticketId: string
) {
  return records.filter((record) => record.ticketId === ticketId);
}

export function getSettlementRunsForDrawing(
  runs: SettlementRun[],
  drawingId: string
) {
  return runs.filter((run) => run.drawingId === drawingId);
}

export function calculateSettlementRunTotals(records: SettlementRecord[]) {
  const processedTicketIds = new Set(records.map((record) => record.ticketId));

  return {
    processedTicketCount: processedTicketIds.size,
    processedLineCount: records.length,
    totalStake: records.reduce(
      (total, record) => total + Number(record.stake || 0),
      0
    ),
    totalPayout: records.reduce(
      (total, record) => total + Number(record.payout || 0),
      0
    ),
    totalNet: records.reduce(
      (total, record) => total + Number(record.netAmount || 0),
      0
    ),
  };
}

export function hasExistingCompletedSettlementForDrawing(
  runs: SettlementRun[],
  drawingId: string,
  exceptRunId?: string
) {
  return runs.some(
    (run) =>
      run.id !== exceptRunId &&
      run.drawingId === drawingId &&
      run.status === "completed"
  );
}

export function buildSettlementRunPayload({
  drawingId,
  gameId,
  notes,
}: {
  drawingId: string;
  gameId: string;
  notes: string;
}): SettlementRun {
  const id = generateSettlementRunId();

  return attachIntegrityHash({
    id,
    drawingId,
    gameId,
    status: "pending",
    expectedTicketCount: 0,
    expectedLineCount: 0,
    startedAt: null,
    completedAt: null,
    executionId: null,
    processedTicketCount: 0,
    processedLineCount: 0,
    winCount: 0,
    lossCount: 0,
    pushCount: 0,
    failedCount: 0,
    totalStake: 0,
    totalPayout: 0,
    totalNet: 0,
    durationMs: 0,
    ticketsPerSecond: 0,
    linesPerSecond: 0,
    drawToSettlementMs: null,
    peakConcurrentSettlements: 0,
    notes: notes.trim(),
    createdAt: new Date().toISOString(),
  }, "settlement_run", id);
}

export function buildPlaceholderSettlementRecords({
  run,
  tickets,
  ticketLines,
}: {
  run: SettlementRun;
  tickets: Ticket[];
  ticketLines: TicketLine[];
}) {
  const acceptedTickets = tickets.filter(
    (ticket) => ticket.drawingId === run.drawingId && ticket.status === "accepted"
  );
  const acceptedTicketIds = new Set(acceptedTickets.map((ticket) => ticket.id));
  const createdAt = new Date().toISOString();
  const records: SettlementRecord[] = ticketLines
    .filter((line) => acceptedTicketIds.has(line.ticketId))
    .map((line, index) => {
      const ticket = acceptedTickets.find(
        (acceptedTicket) => acceptedTicket.id === line.ticketId
      );

      const id = `SETTLEMENT-RECORD-${Date.now()}-${index}`;

      return attachIntegrityHash({
        id,
        settlementRunId: run.id,
        ticketId: line.ticketId,
        ticketLineId: line.id,
        accountId: ticket?.accountId || "",
        gameId: run.gameId,
        drawingId: run.drawingId,
        wagerTypeId: line.wagerTypeId,
        wagerOptionId: line.wagerOptionId || null,
        stake: Number(line.stake || 0),
        payout: 0,
        netAmount: 0,
        outcome: "push",
        status: "pending",
        version: 1,
        previousSettlementRecordId: null,
        reversalOfSettlementRecordId: null,
        ledgerTransactionIds: [],
        createdAt,
      }, "settlement_record", id);
    });

  return {
    acceptedTickets,
    records,
    totals: {
      ...calculateSettlementRunTotals(records),
      processedTicketCount: acceptedTickets.length,
    },
  };
}

export function canTransitionSettlementRunStatus(
  run: SettlementRun,
  nextStatus: SettlementRunStatus,
  runs: SettlementRun[]
) {
  if (nextStatus === "running") {
    return run.status === "pending";
  }

  if (nextStatus === "completed") {
    return (
      (run.status === "running" || run.status === "recovering") &&
      !hasExistingCompletedSettlementForDrawing(runs, run.drawingId, run.id)
    );
  }

  if (nextStatus === "failed") {
    return (
      run.status === "pending" ||
      run.status === "running" ||
      run.status === "recovering" ||
      run.status === "partially_completed"
    );
  }

  if (nextStatus === "cancelled") {
    return (
      run.status === "pending" ||
      run.status === "running" ||
      run.status === "recovering" ||
      run.status === "partially_completed"
    );
  }

  if (nextStatus === "partially_completed") {
    return run.status === "running" || run.status === "recovering";
  }

  if (nextStatus === "recovering") {
    return run.status !== "completed" && run.status !== "cancelled";
  }

  if (nextStatus === "reversed") {
    return run.status === "completed";
  }

  return true;
}

export function applySettlementRunStatusTransition({
  run,
  nextStatus,
  records,
  runs,
}: {
  run: SettlementRun;
  nextStatus: SettlementRunStatus;
  records: SettlementRecord[];
  runs: SettlementRun[];
}) {
  if (!canTransitionSettlementRunStatus(run, nextStatus, runs)) {
    return run;
  }

  const now = new Date().toISOString();
  const totals = calculateSettlementRunTotals(
    getSettlementRecordsForRun(records, run.id)
  );

  return attachIntegrityHash({
    ...run,
    ...totals,
    status: nextStatus,
    startedAt: nextStatus === "running" ? now : run.startedAt,
    completedAt:
      nextStatus === "completed" || nextStatus === "failed"
        ? now
        : run.completedAt,
  }, "settlement_run", run.id, run.previousHash || null);
}

export function reverseSettlementRecords(
  records: SettlementRecord[],
  settlementRunId: string
): SettlementRecord[] {
  return records.map((record): SettlementRecord => {
    if (record.settlementRunId !== settlementRunId) {
      return record;
    }

    const reversedRecord: SettlementRecord = {
      ...record,
      status: "reversed",
      reversalOfSettlementRecordId:
        record.reversalOfSettlementRecordId || record.id,
    };

    return attachIntegrityHash(
      reversedRecord,
      "settlement_record",
      record.id,
      record.previousHash || null
    );
  });
}
