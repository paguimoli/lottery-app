import {
  attachIntegrityHash,
  generateRecordHash,
  verifyHashChain,
  verifyRecordHash,
} from "./integrity.helpers";
import type {
  IntegrityCheckResult,
  IntegrityEntityType,
  IntegrityHashInput,
  IntegrityVerifiableRecord,
} from "./integrity.types";

function sortByCreatedAt(records: IntegrityVerifiableRecord[]) {
  return [...records].sort((a, b) => {
    const aTime = new Date(String(a.createdAt || "")).getTime();
    const bTime = new Date(String(b.createdAt || "")).getTime();

    if (Number.isNaN(aTime) || Number.isNaN(bTime) || aTime === bTime) {
      return String(a.id || "").localeCompare(String(b.id || ""));
    }

    return aTime - bTime;
  });
}

function groupRecords(
  records: IntegrityVerifiableRecord[],
  key: string,
  fallbackKey = "global"
) {
  return records.reduce<Record<string, IntegrityVerifiableRecord[]>>(
    (groups, record) => {
      const groupKey = String(record[key] || fallbackKey);

      return {
        ...groups,
        [groupKey]: [...(groups[groupKey] || []), record],
      };
    },
    {}
  );
}

function verifyGroupedChains(
  records: IntegrityVerifiableRecord[],
  entityType: IntegrityEntityType,
  groupKey?: string
) {
  if (!groupKey) {
    return verifyHashChain(sortByCreatedAt(records), entityType);
  }

  return Object.values(groupRecords(records, groupKey)).flatMap((group) =>
    verifyHashChain(sortByCreatedAt(group), entityType)
  );
}

export function createIntegrityHash(input: IntegrityHashInput) {
  return generateRecordHash({
    ...input,
    hashVersion: input.hashVersion || "1",
  });
}

export function attachIntegrityToRecord<T extends object>(
  record: T,
  entityType: IntegrityEntityType,
  entityId: string,
  previousHash?: string | null
) {
  return attachIntegrityHash(record, entityType, entityId, previousHash);
}

export function verifyIntegrityRecord(
  record: IntegrityVerifiableRecord,
  entityType: IntegrityEntityType,
  entityId?: string
) {
  return verifyRecordHash(record, entityType, entityId);
}

export function verifyIntegrityChain(
  records: IntegrityVerifiableRecord[],
  entityType: IntegrityEntityType
) {
  return verifyHashChain(sortByCreatedAt(records), entityType);
}

export function verifyLedgerIntegrity(records: IntegrityVerifiableRecord[]) {
  const hasAccountScopedRecords = records.some((record) => record.accountId);

  return verifyGroupedChains(
    records,
    "ledger_transaction",
    hasAccountScopedRecords ? "accountId" : undefined
  );
}

export function verifySettlementIntegrity(records: IntegrityVerifiableRecord[]) {
  return verifyGroupedChains(records, "settlement_record", "settlementRunId");
}

export function verifyAuditIntegrity(records: IntegrityVerifiableRecord[]) {
  return verifyGroupedChains(records, "audit_event");
}

export function verifyOverrideApprovalIntegrity(
  records: IntegrityVerifiableRecord[]
) {
  return verifyGroupedChains(records, "override_approval");
}

export function verifyOfficialResultIntegrity(records: IntegrityVerifiableRecord[]) {
  return verifyGroupedChains(records, "official_result", "gameId");
}

export function verifyTicketIntegrity(records: IntegrityVerifiableRecord[]) {
  return records.map((record) => verifyIntegrityRecord(record, "ticket"));
}

export function verifyTicketLineIntegrity(records: IntegrityVerifiableRecord[]) {
  return records.map((record) => verifyIntegrityRecord(record, "ticket_line"));
}

export function verifyRngResultIntegrity(records: IntegrityVerifiableRecord[]) {
  return records.map((record) => verifyIntegrityRecord(record, "rng_result"));
}

export function getIntegrityFailures(results: IntegrityCheckResult[]) {
  return results.filter((result) => result.status !== "valid");
}
