import type {
  AuthorityValue,
  ComparisonMode,
  ServiceHealthStatus,
} from "../authority-control/authority-control.types";
import type { DomainReadinessStatus } from "../shadow-readiness/shadow-readiness.types";

export type CreditAuthorityCandidateStatus = "READY" | "WARNING" | "BLOCKED";

export type CreditAuthorityDryRunMode = "ENABLED" | "DISABLED";

export type CreditAuthorityRuntimeRoute = {
  authoritativePath: AuthorityValue;
  comparisonMode: ComparisonMode;
  comparisonPath: "MONOLITH" | "CREDIT_SERVICE" | null;
  dryRunMode: CreditAuthorityDryRunMode;
  productionCutoverActive: boolean;
  reasons: string[];
};

export type CreditAuthorityMetrics = {
  totalRuns: number;
  matches: number;
  mismatches: number;
  failures: number;
  mismatchRate: number;
  failureRate: number;
  criticalMismatchPresent: boolean;
  shadowReadinessStatus: CreditAuthorityCandidateStatus;
};

export type CreditAuthorityThresholds = {
  mismatchAlertThreshold: number;
  rollbackFailureThreshold: number;
};

export type CreditRollbackTriggerEvaluation = {
  shouldTriggerRollback: boolean;
  status: CreditAuthorityCandidateStatus;
  reasons: string[];
};

export type CreditAuthorityReadiness = {
  status: CreditAuthorityCandidateStatus;
  authority: AuthorityValue;
  comparisonMode: ComparisonMode;
  dryRunMode: CreditAuthorityDryRunMode;
  runtimeRoute: CreditAuthorityRuntimeRoute;
  metrics: CreditAuthorityMetrics | null;
  thresholds: CreditAuthorityThresholds;
  rollbackReadinessStatus: CreditAuthorityCandidateStatus;
  rollbackTrigger: CreditRollbackTriggerEvaluation;
  readinessReasons: string[];
  remainingBlockers: string[];
  evaluatedAt: string;
};

export type CreditDryRunEvaluation = {
  authorityCandidate: "CREDIT";
  currentState: string;
  ifServiceBecameAuthoritativeNow: {
    wouldRollbackTrigger: boolean;
    wouldThresholdsBeExceeded: boolean;
    wouldPromotionBeAllowed: boolean;
  };
  rawEvidence: {
    readiness: DomainReadinessStatus;
    mismatchRate: number;
    failureRate: number;
  };
  adjustedEvidence: {
    readiness: DomainReadinessStatus;
    mismatchRate: number;
    failureRate: number;
  };
  promotionEvidence: {
    readiness: DomainReadinessStatus;
    mismatchRate: number;
    failureRate: number;
  };
  postPromotionEvidence: {
    totalRuns: number;
    matches: number;
    mismatches: number;
    failures: number;
    criticalMismatchCount: number;
    readiness: DomainReadinessStatus;
  };
  rollbackReadiness: DomainReadinessStatus;
  promotionBlockers: string[];
  approvalRequirements: string[];
  evaluatedAt: string;
};

export type CreditSimulationResult = {
  domain: "CREDIT";
  currentAuthority?: AuthorityValue;
  proposedAuthority?: "SERVICE";
  simulatedAuthority?: AuthorityValue;
  authorityState?: AuthorityValue;
  comparisonMode: ComparisonMode;
  promotionDecision?: string;
  rollbackReadiness: DomainReadinessStatus;
  rollbackReady: boolean;
  serviceHealth: ServiceHealthStatus;
  validationResults: Array<{
    name: string;
    passed: boolean;
    message: string;
  }>;
  blockers: string[];
  warnings: string[];
  promotionAllowed?: boolean;
  rollbackAllowed?: boolean;
  auditEvent: {
    id: string;
    eventType: string;
    correlationId: string | null;
  };
  simulatedAt: string;
};

export type CreditAuthorityPromotion = {
  domain: "CREDIT";
  previousAuthority: AuthorityValue;
  newAuthority: "SERVICE";
  comparisonMode: "ENABLED";
  rollbackReadiness: DomainReadinessStatus;
  promotionApprovalId: string | null;
  promotedAt: string;
  correlationId: string | null;
  idempotent: boolean;
  auditEvent: {
    id: string;
    eventType: string;
    correlationId: string | null;
  } | null;
};

export type CreditPromotionStatus = {
  domain: "CREDIT";
  authority: AuthorityValue;
  comparisonMode: ComparisonMode;
  promotedAt: string | null;
  rollbackReady: boolean;
  rollbackReadiness: DomainReadinessStatus;
  promotionApprovalId: string | null;
  evaluatedAt: string;
};
