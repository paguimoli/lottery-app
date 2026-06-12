export type IntegrityEntityType =
  | "ledger_transaction"
  | "settlement_record"
  | "settlement_run"
  | "audit_event"
  | "override_approval"
  | "official_result"
  | "ticket"
  | "ticket_line"
  | "rng_result";

export type IntegrityStatus =
  | "valid"
  | "invalid"
  | "missing_hash"
  | "chain_broken";

export type IntegrityCheckResult = {
  entityType: IntegrityEntityType;
  entityId: string;
  status: IntegrityStatus;
  expectedHash?: string | null;
  actualHash?: string | null;
  previousHash?: string | null;
  message: string;
};

export type IntegrityHashInput = {
  entityType: IntegrityEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  previousHash?: string | null;
  hashVersion?: string;
};

export type IntegrityProtectedRecord = {
  recordHash?: string | null;
  previousHash?: string | null;
  hashVersion?: string | null;
};

export type IntegrityVerifiableRecord = Record<string, unknown> &
  IntegrityProtectedRecord & {
    id?: string;
    entityId?: string;
  };
