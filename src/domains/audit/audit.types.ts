export type AuditActorType = "admin" | "system" | "worker";

export type AuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType: AuditActorType;
  actorId: string;
  oldValue?: unknown;
  newValue?: unknown;
  reasonCode?: string | null;
  approvalId?: string | null;
  metadata?: Record<string, unknown>;
  recordHash?: string | null;
  previousHash?: string | null;
  hashVersion?: string | null;
  createdAt: string;
};

export type CreateAuditEventInput = {
  entityType: string;
  entityId: string;
  action: string;
  actorType: AuditActorType;
  actorId: string;
  oldValue?: unknown;
  newValue?: unknown;
  reasonCode?: string | null;
  approvalId?: string | null;
  metadata?: Record<string, unknown>;
};

export const AUDIT_ACTIONS = {
  SETTLEMENT_RUN_CREATED: "SETTLEMENT_RUN_CREATED",
  SETTLEMENT_RUN_COMPLETED: "SETTLEMENT_RUN_COMPLETED",
  SETTLEMENT_RUN_FAILED: "SETTLEMENT_RUN_FAILED",

  RESETTLEMENT_REQUESTED: "RESETTLEMENT_REQUESTED",
  RESETTLEMENT_APPROVED: "RESETTLEMENT_APPROVED",
  RESETTLEMENT_EXECUTED: "RESETTLEMENT_EXECUTED",
  RESETTLEMENT_BLOCKED: "RESETTLEMENT_BLOCKED",

  LEDGER_TRANSACTION_CREATED: "LEDGER_TRANSACTION_CREATED",
  LEDGER_REVERSAL_CREATED: "LEDGER_REVERSAL_CREATED",
  MANUAL_ADJUSTMENT_CREATED: "MANUAL_ADJUSTMENT_CREATED",

  ACCOUNT_CREATED: "ACCOUNT_CREATED",
  ACCOUNT_UPDATED: "ACCOUNT_UPDATED",
  ACCOUNT_MOVED: "ACCOUNT_MOVED",
  ACCOUNT_DEACTIVATED: "ACCOUNT_DEACTIVATED",

  ADMIN_CREATED: "ADMIN_CREATED",
  ADMIN_UPDATED: "ADMIN_UPDATED",
  ROLE_CREATED: "ROLE_CREATED",
  ROLE_UPDATED: "ROLE_UPDATED",
  ROLE_DELETED: "ROLE_DELETED",
  PERMISSION_GRANTED: "PERMISSION_GRANTED",
  PERMISSION_REVOKED: "PERMISSION_REVOKED",

  RESULT_POSTED: "RESULT_POSTED",
  RESULT_CORRECTED: "RESULT_CORRECTED",
  RESULT_VOIDED: "RESULT_VOIDED",

  OVERRIDE_REQUEST_CREATED: "OVERRIDE_REQUEST_CREATED",
  OVERRIDE_REQUEST_APPROVED: "OVERRIDE_REQUEST_APPROVED",
  OVERRIDE_REQUEST_REJECTED: "OVERRIDE_REQUEST_REJECTED",

  INTEGRITY_VERIFIED: "INTEGRITY_VERIFIED",
  INTEGRITY_FAILED: "INTEGRITY_FAILED",
  HASH_CHAIN_BROKEN: "HASH_CHAIN_BROKEN",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type FinancialAuditRecord = {
  table: string;
  id: string;
  record: Record<string, unknown>;
};

export type FinancialOutboxAuditEvent = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  status: string;
  correlationId: string | null;
  createdAt: string;
  publishedAt: string | null;
};

export type FinancialAuthAuditEvent = {
  id: string;
  userId: string | null;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type FinancialAuditGapSeverity = "INFO" | "WARNING" | "FAIL";

export type FinancialAuditGap = {
  severity: FinancialAuditGapSeverity;
  code: string;
  message: string;
  entityType?: string;
  entityId?: string;
};

export type FinancialAuditTrail = {
  queryType: string;
  queryId: string;
  correlationIds: string[];
  sourceRecords: FinancialAuditRecord[];
  authAuditEvents: FinancialAuthAuditEvent[];
  outboxEvents: FinancialOutboxAuditEvent[];
  gaps: FinancialAuditGap[];
  reconstructable: boolean;
};

export type FinancialAuditValidationInput =
  | { ticketId: string }
  | { reservationId: string }
  | { ledgerTransactionId: string }
  | { commissionRunId: string }
  | { correlationId: string }
  | { weekStart: string; weekEnd: string; currency?: string | null };
