export type CreditShadowComparisonStatus = "MATCH" | "MISMATCH" | "NOT_COMPARED";
export type CreditShadowOperationType = "RESERVE" | "RELEASE" | "SETTLEMENT";

export type CreditShadowMismatchType =
  | "AVAILABLE_CREDIT_MISMATCH"
  | "RESERVATION_AMOUNT_MISMATCH"
  | "EXPOSURE_MISMATCH"
  | "SETTLEMENT_CREDIT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "UNKNOWN_MISMATCH";

export type CreditShadowSeverity = "INFO" | "WARNING" | "CRITICAL";

export type CreditShadowRun = {
  id: string;
  correlationId?: string | null;
  operationType: CreditShadowOperationType;
  accountId: string;
  walletId?: string | null;
  ticketId?: string | null;
  reservationId?: string | null;
  comparisonStatus: CreditShadowComparisonStatus;
  shadowAmountMinor: number;
  monolithAmountMinor?: number | null;
  shadowAvailableCredit?: number | null;
  monolithAvailableCredit?: number | null;
  shadowReservedAmount?: number | null;
  monolithReservedAmount?: number | null;
  shadowReleasedAmount?: number | null;
  monolithReleasedAmount?: number | null;
  shadowRemainingExposure?: number | null;
  monolithRemainingExposure?: number | null;
  shadowBalanceImpact?: number | null;
  monolithBalanceImpact?: number | null;
  currency: string;
  shadowServiceVersion?: string | null;
  createdAt: string;
};

export type CreditShadowMismatch = {
  id: string;
  shadowRunId: string;
  mismatchType: CreditShadowMismatchType;
  fieldName: string;
  monolithValue?: string | null;
  shadowValue?: string | null;
  severity: CreditShadowSeverity;
  createdAt: string;
  run?: CreditShadowRun | null;
};

export type CreditShadowFailure = {
  id: string;
  correlationId?: string | null;
  reservationId?: string | null;
  ticketId?: string | null;
  failureReason: string;
  failureType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CreditShadowSummary = {
  totalRuns: number;
  matches: number;
  mismatches: number;
  failures: number;
  matchPercentage: number;
  mismatchPercentage: number;
  failurePercentage: number;
  readiness: {
    status: "READY" | "WARNING" | "BLOCKED";
    reasons: string[];
    thresholds: {
      readyMismatchRate: number;
      readyFailureRate: number;
      blockedMismatchRate: number;
    };
  };
  generatedAt: string;
};

export type CreditShadowListFilters = {
  reservationId?: string | null;
  ticketId?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};
