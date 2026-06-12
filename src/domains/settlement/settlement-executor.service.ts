import type { Ticket, TicketLine, TicketLineStatus } from "../tickets/ticket.types";
import { attachIntegrityHash } from "../integrity/integrity.helpers";
import type {
  KenoDrawMetrics,
  PayTableRow,
  WagerOption,
  WagerType,
} from "../wagers/wager.types";
import {
  failedResult,
  type SettlementEvaluationResult,
} from "./evaluators/settlement-evaluator.types";
import { evaluateTicketLine } from "./settlement-evaluator-router.service";
import type {
  SettlementOutcome,
  SettlementRecord,
  SettlementRecordStatus,
  SettlementRun,
  SettlementRunStatus,
} from "./settlement.types";

export type SettlementExecutionError = {
  ticketId: string;
  ticketLineId: string;
  message: string;
  timestamp: string;
};

export type SettlementExecutionInput = {
  settlementRun: SettlementRun;
  drawingId: string;
  gameId: string;
  tickets: Ticket[];
  ticketLines: TicketLine[];
  wagerTypes: WagerType[];
  wagerOptions: WagerOption[];
  payTableRows: PayTableRow[];
  winningNumbers: number[];
  bullseyeNumber?: number | null;
  drawMetrics?: KenoDrawMetrics | null;
  officialResultPostedAt?: string | null;
  existingSettlementRecords?: SettlementRecord[];
  executionId?: string | null;
};

export type SettlementExecutionSummary = {
  settlementRunId: string;
  drawingId: string;
  gameId: string;
  executionId: string;
  status: SettlementRunStatus;
  expectedTicketCount: number;
  expectedLineCount: number;
  processedTicketCount: number;
  processedLineCount: number;
  winCount: number;
  lossCount: number;
  pushCount: number;
  failedCount: number;
  totalStake: number;
  totalPayout: number;
  totalNet: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  ticketsPerSecond: number;
  linesPerSecond: number;
  drawToSettlementMs?: number | null;
  peakConcurrentSettlements: number;
};

export type SettlementExecutionResult = {
  summary: SettlementExecutionSummary;
  settlementRecords: SettlementRecord[];
  updatedTickets: Ticket[];
  updatedTicketLines: TicketLine[];
  errors: string[];
  executionErrors: SettlementExecutionError[];
};

const FINAL_LINE_STATUSES: TicketLineStatus[] = [
  "won",
  "lost",
  "push",
  "void",
  "cancelled",
  "resettled",
];

function createSettlementRecordId({
  settlementRunId,
  ticketLineId,
  index,
}: {
  settlementRunId: string;
  ticketLineId: string;
  index: number;
}) {
  return `SETTLEMENT-RECORD-${settlementRunId}-${ticketLineId}-${index}`;
}

function mapEvaluationToRecordStatus(
  outcome: SettlementEvaluationResult["outcome"]
): SettlementRecordStatus {
  if (outcome === "void") {
    return "void";
  }

  if (outcome === "failed") {
    return "failed";
  }

  return "settled";
}

function mapEvaluationToLineStatus(
  outcome: SettlementEvaluationResult["outcome"]
): TicketLineStatus | null {
  if (outcome === "win") {
    return "won";
  }

  if (outcome === "loss") {
    return "lost";
  }

  if (outcome === "push") {
    return "push";
  }

  if (outcome === "void") {
    return "void";
  }

  return null;
}

function mapRecordToLineStatus(record: SettlementRecord): TicketLineStatus | null {
  if (record.outcome === "win") {
    return "won";
  }

  if (record.outcome === "loss") {
    return "lost";
  }

  if (record.outcome === "push") {
    return "push";
  }

  if (record.outcome === "void") {
    return "void";
  }

  return null;
}

function getRunStatusFromSummary({
  expectedTicketCount,
  expectedLineCount,
  processedTicketCount,
  processedLineCount,
  failedCount,
}: {
  expectedTicketCount: number;
  expectedLineCount: number;
  processedTicketCount: number;
  processedLineCount: number;
  failedCount: number;
}): SettlementRunStatus {
  if (
    processedTicketCount === expectedTicketCount &&
    processedLineCount === expectedLineCount &&
    failedCount === 0
  ) {
    return "completed";
  }

  return "partially_completed";
}

function calculateRate(count: number, durationMs: number) {
  if (durationMs <= 0) {
    return count;
  }

  return count / (durationMs / 1000);
}

function calculateDrawToSettlementMs({
  officialResultPostedAt,
  completedAt,
}: {
  officialResultPostedAt?: string | null;
  completedAt: Date;
}) {
  if (!officialResultPostedAt) {
    return null;
  }

  const postedAtMs = new Date(officialResultPostedAt).getTime();

  if (Number.isNaN(postedAtMs)) {
    return null;
  }

  return completedAt.getTime() - postedAtMs;
}

export function executeSettlementRun(
  input: SettlementExecutionInput
): SettlementExecutionResult {
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();
  const executionId =
    input.executionId ||
    `SETTLEMENT-EXECUTION-${input.settlementRun.id}-${startedAtDate.getTime()}`;
  const errors: string[] = [];
  const executionErrors: SettlementExecutionError[] = [];
  const eligibleTickets = input.tickets.filter(
    (ticket) =>
      ticket.drawingId === input.drawingId &&
      ticket.gameId === input.gameId &&
      ticket.status === "accepted"
  );
  const eligibleTicketIds = new Set(eligibleTickets.map((ticket) => ticket.id));
  const expectedTicketCount = eligibleTickets.length;
  const expectedLineCount = input.ticketLines.filter((line) =>
    eligibleTicketIds.has(line.ticketId)
  ).length;
  const existingRunRecords = (input.existingSettlementRecords || []).filter(
    (record) => record.settlementRunId === input.settlementRun.id
  );
  const existingRecordLineIds = new Set(
    existingRunRecords.map((record) => record.ticketLineId)
  );
  const lineStatusUpdates = new Map<string, TicketLineStatus>();
  const settlementRecords: SettlementRecord[] = [];

  for (const record of existingRunRecords) {
    const existingLineStatus = mapRecordToLineStatus(record);

    if (existingLineStatus) {
      lineStatusUpdates.set(record.ticketLineId, existingLineStatus);
    }
  }

  // Performance targets:
  // Rapid Draw: 25 second draw interval, 5 second lockout, settle under 5 seconds.
  // Hot Spot: 4 minute draw interval, settle under 15 seconds.
  for (const ticket of eligibleTickets) {
    const pendingLines = input.ticketLines.filter(
      (line) => line.ticketId === ticket.id && line.status === "pending"
    );

    for (const line of pendingLines) {
      if (existingRecordLineIds.has(line.id)) {
        errors.push(
          `Skipped duplicate settlement record for ticket line ${line.id}.`
        );
        continue;
      }

      const wagerType = input.wagerTypes.find(
        (type) => type.id === line.wagerTypeId
      );
      const wagerOption = line.wagerOptionId
        ? input.wagerOptions.find((option) => option.id === line.wagerOptionId)
        : null;
      const evaluation = wagerType
        ? evaluateTicketLine({
            ticketLine: line,
            wagerType,
            wagerOption,
            winningNumbers: input.winningNumbers,
            bullseyeNumber: input.bullseyeNumber,
            drawMetrics: input.drawMetrics,
            payTableRows: input.payTableRows,
          })
        : failedResult({
            reason: `Wager type not found for ticket line ${line.id}.`,
            metadata: { wagerTypeId: line.wagerTypeId },
          });

      if (!wagerType) {
        errors.push(`Wager type not found for ticket line ${line.id}.`);
      }

      const lineStatus = mapEvaluationToLineStatus(evaluation.outcome);

      if (lineStatus) {
        lineStatusUpdates.set(line.id, lineStatus);
      } else {
        const message = `Ticket line ${line.id} failed settlement evaluation and remains pending.`;

        errors.push(message);
        executionErrors.push({
          ticketId: ticket.id,
          ticketLineId: line.id,
          message,
          timestamp: startedAt,
        });
      }

      const recordId = createSettlementRecordId({
          settlementRunId: input.settlementRun.id,
          ticketLineId: line.id,
          index: settlementRecords.length,
        });
      const previousHash =
        settlementRecords[settlementRecords.length - 1]?.recordHash ||
        existingRunRecords[existingRunRecords.length - 1]?.recordHash ||
        null;

      settlementRecords.push(attachIntegrityHash({
        id: recordId,
        settlementRunId: input.settlementRun.id,
        ticketId: line.ticketId,
        ticketLineId: line.id,
        accountId: ticket.accountId,
        gameId: input.gameId,
        drawingId: input.drawingId,
        wagerTypeId: line.wagerTypeId,
        wagerOptionId: line.wagerOptionId || null,
        stake: Number(line.stake || 0),
        payout: Number(evaluation.payout || 0),
        netAmount: Number(evaluation.netAmount || 0),
        outcome: evaluation.outcome as SettlementOutcome,
        status: mapEvaluationToRecordStatus(evaluation.outcome),
        version: 1,
        previousSettlementRecordId: null,
        reversalOfSettlementRecordId: null,
        // TODO Phase 5.5: create idempotent operational ledger entries here.
        ledgerTransactionIds: [],
        createdAt: startedAt,
      }, "settlement_record", recordId, previousHash));
      existingRecordLineIds.add(line.id);
    }
  }

  const completedAtDate = new Date();
  const completedAt = completedAtDate.toISOString();
  const allRunRecords = [...existingRunRecords, ...settlementRecords];
  const updatedTicketLines = input.ticketLines.map((line) => {
    const nextStatus = lineStatusUpdates.get(line.id);

    if (!nextStatus) {
      return line;
    }

    return {
      ...line,
      status: nextStatus,
      resultAmount:
        nextStatus === "won"
          ? allRunRecords.find((record) => record.ticketLineId === line.id)
              ?.payout ?? line.resultAmount
          : nextStatus === "lost"
            ? 0
            : line.resultAmount,
    };
  });
  const updatedTickets = input.tickets.map((ticket) => {
    if (!eligibleTicketIds.has(ticket.id)) {
      return ticket;
    }

    const linesForTicket = updatedTicketLines.filter(
      (line) => line.ticketId === ticket.id
    );
    const allLinesFinal =
      linesForTicket.length > 0 &&
      linesForTicket.every((line) => FINAL_LINE_STATUSES.includes(line.status));

    if (!allLinesFinal) {
      return ticket;
    }

    return {
      ...ticket,
      status: "settled" as const,
      settledAt: completedAt,
    };
  });
  const durationMs = completedAtDate.getTime() - startedAtDate.getTime();
  const processedTicketCount = new Set(
    allRunRecords.map((record) => record.ticketId)
  ).size;
  const processedLineCount = allRunRecords.length;
  const winCount = allRunRecords.filter(
    (record) => record.outcome === "win"
  ).length;
  const lossCount = allRunRecords.filter(
    (record) => record.outcome === "loss"
  ).length;
  const pushCount = allRunRecords.filter(
    (record) => record.outcome === "push"
  ).length;
  const failedCount = allRunRecords.filter(
    (record) => record.outcome === "failed"
  ).length;
  const totalStake = allRunRecords.reduce(
    (total, record) => total + Number(record.stake || 0),
    0
  );
  const totalPayout = allRunRecords.reduce(
    (total, record) => total + Number(record.payout || 0),
    0
  );
  const totalNet = allRunRecords.reduce(
    (total, record) => total + Number(record.netAmount || 0),
    0
  );
  const status = getRunStatusFromSummary({
    expectedTicketCount,
    expectedLineCount,
    processedTicketCount,
    processedLineCount,
    failedCount,
  });

  return {
    summary: {
      settlementRunId: input.settlementRun.id,
      drawingId: input.drawingId,
      gameId: input.gameId,
      executionId,
      status,
      expectedTicketCount,
      expectedLineCount,
      processedTicketCount,
      processedLineCount,
      winCount,
      lossCount,
      pushCount,
      failedCount,
      totalStake,
      totalPayout,
      totalNet,
      startedAt,
      completedAt,
      durationMs,
      ticketsPerSecond: calculateRate(processedTicketCount, durationMs),
      linesPerSecond: calculateRate(processedLineCount, durationMs),
      drawToSettlementMs: calculateDrawToSettlementMs({
        officialResultPostedAt: input.officialResultPostedAt,
        completedAt: completedAtDate,
      }),
      peakConcurrentSettlements: 1,
    },
    settlementRecords,
    updatedTickets,
    updatedTicketLines,
    errors,
    executionErrors,
  };
}
