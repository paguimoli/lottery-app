import type {
  SettlementExecutionInput,
  SettlementExecutionResult,
} from "./settlement-executor.service";
import { executeSettlementRun } from "./settlement-executor.service";
import type { SettlementRecord, SettlementRun } from "./settlement.types";

export function isSettlementRunComplete(run: SettlementRun) {
  return (
    run.processedTicketCount === run.expectedTicketCount &&
    run.processedLineCount === run.expectedLineCount &&
    run.failedCount === 0
  );
}

export function getIncompleteSettlementRuns(runs: SettlementRun[]) {
  return runs.filter((run) =>
    ["running", "partially_completed", "recovering"].includes(run.status)
  );
}

export function canResumeSettlementRun(run: SettlementRun) {
  return run.status !== "completed" && run.status !== "cancelled";
}

export function hasExistingSettlementRecord({
  records,
  settlementRunId,
  ticketLineId,
}: {
  records: SettlementRecord[];
  settlementRunId: string;
  ticketLineId: string;
}) {
  return records.some(
    (record) =>
      record.settlementRunId === settlementRunId &&
      record.ticketLineId === ticketLineId
  );
}

export function generateSettlementExecutionId(settlementRunId?: string) {
  const scope = settlementRunId || "UNSCOPED";

  // Future workers should persist this id per attempt and use it for logs,
  // job retries, idempotency keys, and crash recovery diagnostics.
  return `SETTLEMENT-EXECUTION-${scope}-${Date.now()}`;
}

export function resumeSettlementRun(
  input: SettlementExecutionInput
): SettlementExecutionResult {
  return executeSettlementRun({
    ...input,
    executionId: generateSettlementExecutionId(input.settlementRun.id),
    settlementRun: {
      ...input.settlementRun,
      status: "recovering",
    },
  });
}
