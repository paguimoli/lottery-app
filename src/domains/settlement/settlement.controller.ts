import {
  controllerFailure,
  controllerSuccess,
} from "@/src/lib/controller/controller.types";
import type { Ticket, TicketLine } from "../tickets/ticket.types";
import {
  applySettlementRunStatusTransition,
  buildPlaceholderSettlementRecords,
  buildSettlementRunPayload,
  reverseSettlementRecords,
} from "./settlement.service";
import type {
  SettlementRecord,
  SettlementRun,
  SettlementRunStatus,
} from "./settlement.types";
import {
  validatePlaceholderSettlementRecords,
  validateSettlementRunCreation,
  validateSettlementStatusTransition,
} from "./settlement.validation";

export function createSettlementRunController({
  drawingId,
  gameId,
  notes,
  runs,
}: {
  drawingId: string;
  gameId: string;
  notes: string;
  runs: SettlementRun[];
}) {
  const validation = validateSettlementRunCreation({ drawingId, runs });

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const run = buildSettlementRunPayload({ drawingId, gameId, notes });

  return controllerSuccess({
    run,
    runs: [...runs, run],
  });
}

export function generatePlaceholderSettlementRecordsController({
  settlementRunId,
  runs,
  records,
  tickets,
  ticketLines,
}: {
  settlementRunId: string;
  runs: SettlementRun[];
  records: SettlementRecord[];
  tickets: Ticket[];
  ticketLines: TicketLine[];
}) {
  const run = runs.find((createdRun) => createdRun.id === settlementRunId);

  if (!run) {
    return controllerFailure("Settlement run not found.");
  }

  const validation = validatePlaceholderSettlementRecords({
    records,
    settlementRunId,
  });

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const built = buildPlaceholderSettlementRecords({ run, tickets, ticketLines });

  return controllerSuccess({
    acceptedTickets: built.acceptedTickets,
    records: [...records, ...built.records],
    newRecords: built.records,
    runs: runs.map((createdRun) =>
      createdRun.id === settlementRunId
        ? {
            ...createdRun,
            processedTicketCount: built.acceptedTickets.length,
            processedLineCount: built.records.length,
            totalStake: built.totals.totalStake,
            totalPayout: built.totals.totalPayout,
            totalNet: built.totals.totalNet,
          }
        : createdRun
    ),
  });
}

export function updateSettlementRunStatusController({
  settlementRunId,
  nextStatus,
  runs,
  records,
}: {
  settlementRunId: string;
  nextStatus: SettlementRunStatus;
  runs: SettlementRun[];
  records: SettlementRecord[];
}) {
  const run = runs.find((createdRun) => createdRun.id === settlementRunId);
  const validation = validateSettlementStatusTransition({
    run,
    nextStatus,
    runs,
  });

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const nextRuns = runs.map((createdRun) =>
    createdRun.id === settlementRunId
      ? applySettlementRunStatusTransition({
          run: createdRun,
          nextStatus,
          records,
          runs,
        })
      : createdRun
  );

  return controllerSuccess({
    runs: nextRuns,
    records:
      nextStatus === "reversed"
        ? reverseSettlementRecords(records, settlementRunId)
        : records,
  });
}

export function reverseSettlementRunController({
  settlementRunId,
  runs,
  records,
}: {
  settlementRunId: string;
  runs: SettlementRun[];
  records: SettlementRecord[];
}) {
  return updateSettlementRunStatusController({
    settlementRunId,
    nextStatus: "reversed",
    runs,
    records,
  });
}
