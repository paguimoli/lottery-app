import { attachIntegrityHash } from "../integrity/integrity.helpers";
import { executeSettlementRun } from "./settlement-executor.service";
import type { SettlementRecord } from "./settlement.types";
import type {
  ResettlementExecutionInput,
  ResettlementExecutionResult,
} from "./resettlement.types";
import { validateResettlementEligibility } from "./resettlement.validation";

function createReversalSettlementRecordId({
  resettlementRunId,
  originalRecordId,
}: {
  resettlementRunId: string;
  originalRecordId: string;
}) {
  return `SETTLEMENT-REVERSAL-${resettlementRunId}-${originalRecordId}`;
}

function hasReversalForSettlementRecord({
  records,
  originalRecordId,
}: {
  records: SettlementRecord[];
  originalRecordId: string;
}) {
  return records.some(
    (record) => record.reversalOfSettlementRecordId === originalRecordId
  );
}

function getPreviousRecordForTicketLine({
  records,
  ticketLineId,
}: {
  records: SettlementRecord[];
  ticketLineId: string;
}) {
  return records
    .filter((record) => record.ticketLineId === ticketLineId)
    .sort((a, b) => b.version - a.version)[0];
}

export function createSettlementReversalRecords({
  originalSettlementRecords,
  resettlementRunId,
  existingSettlementRecords = [],
}: {
  originalSettlementRecords: SettlementRecord[];
  resettlementRunId: string;
  existingSettlementRecords?: SettlementRecord[];
}) {
  const createdAt = new Date().toISOString();

  return originalSettlementRecords
    .filter((record) => record.status === "settled")
    .filter(
      (record) =>
        !hasReversalForSettlementRecord({
          records: [...existingSettlementRecords, ...originalSettlementRecords],
          originalRecordId: record.id,
        })
    )
    .map((record): SettlementRecord => {
      const id = createReversalSettlementRecordId({
        resettlementRunId,
        originalRecordId: record.id,
      });

      return attachIntegrityHash(
        {
          id,
          settlementRunId: resettlementRunId,
          ticketId: record.ticketId,
          ticketLineId: record.ticketLineId,
          accountId: record.accountId,
          gameId: record.gameId,
          drawingId: record.drawingId,
          wagerTypeId: record.wagerTypeId,
          wagerOptionId: record.wagerOptionId || null,
          stake: record.stake,
          payout: -Number(record.payout || 0),
          netAmount: -Number(record.netAmount || 0),
          outcome: record.outcome,
          status: "reversed",
          version: record.version + 1,
          previousSettlementRecordId: record.id,
          reversalOfSettlementRecordId: record.id,
          ledgerTransactionIds: [],
          createdAt,
        },
        "settlement_record",
        id,
        record.recordHash || null
      );
    });
}

export function createCorrectedSettlementRecords({
  correctedSettlementRecords,
  previousSettlementRecords,
}: {
  correctedSettlementRecords: SettlementRecord[];
  previousSettlementRecords: SettlementRecord[];
}) {
  return correctedSettlementRecords.map((record) => {
    const previousRecord = getPreviousRecordForTicketLine({
      records: previousSettlementRecords,
      ticketLineId: record.ticketLineId,
    });

    return attachIntegrityHash(
      {
        ...record,
        version: previousRecord ? previousRecord.version + 1 : record.version,
        previousSettlementRecordId: previousRecord?.id || null,
        reversalOfSettlementRecordId: null,
      },
      "settlement_record",
      record.id,
      previousRecord?.recordHash || null
    );
  });
}

export function executeResettlement({
  settlementRun,
  accountingPeriod,
  overrideApproval,
  requestedByAdminId,
  originalSettlementRecords,
  correctedSettlementExecutionInput,
}: ResettlementExecutionInput): ResettlementExecutionResult {
  const eligibility = validateResettlementEligibility({
    settlementRun,
    accountingPeriod,
    overrideApproval,
    requestedByAdminId,
  });

  if (!eligibility.eligible) {
    return {
      success: false,
      errors: eligibility.errors,
      reversalSettlementRecords: [],
      reversalLedgerTransactions: [],
      correctedSettlementRecords: [],
      correctedLedgerTransactions: [],
    };
  }

  const reversalSettlementRecords = createSettlementReversalRecords({
    originalSettlementRecords,
    resettlementRunId: correctedSettlementExecutionInput.settlementRun.id,
    existingSettlementRecords: correctedSettlementExecutionInput.existingSettlementRecords,
  });
  const correctedExecution = executeSettlementRun(correctedSettlementExecutionInput);
  const correctedSettlementRecords = createCorrectedSettlementRecords({
    correctedSettlementRecords: correctedExecution.settlementRecords,
    previousSettlementRecords: [
      ...originalSettlementRecords,
      ...reversalSettlementRecords,
    ],
  });

  return {
    success: true,
    errors: correctedExecution.errors,
    reversalSettlementRecords,
    reversalLedgerTransactions: [],
    correctedSettlementRecords,
    correctedLedgerTransactions: [],
  };
}
