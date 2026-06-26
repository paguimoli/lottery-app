import type {
  AuthorityValue,
  ComparisonMode,
  DomainRollbackReadiness,
  RollbackReadinessStatus,
  ServiceHealthStatus,
} from "../authority-control/authority-control.types";
import type { OutboxEvent } from "../outbox/outbox.types";
import type {
  OperationsMetricsSummary,
  OutboxObservabilitySummary,
} from "../operations/worker-observability.types";
import type { QueueHealthSummary } from "../operations/queue-health.types";

export type BaselineStatus = "READY" | "WARNING" | "BLOCKED";

export type AuthorityBaselineDomainStatus = {
  authority: AuthorityValue;
  certificationStatus: string;
  comparisonMode: ComparisonMode;
  rollbackReadiness: RollbackReadinessStatus;
  rollbackReady: boolean;
  serviceHealth: ServiceHealthStatus;
};

export type BaselineCheck = {
  name: string;
  status: BaselineStatus;
  message: string;
  metrics: Record<string, unknown>;
};

export type FinancialInvariantReport = {
  status: BaselineStatus;
  checks: BaselineCheck[];
  generatedAt: string;
};

export type RollbackDrillSummary = {
  settlement: Pick<
    DomainRollbackReadiness,
    "authority" | "comparisonMode" | "rollbackStatus" | "serviceHealth" | "reasons"
  >;
  ledger: Pick<
    DomainRollbackReadiness,
    "authority" | "comparisonMode" | "rollbackStatus" | "serviceHealth" | "reasons"
  >;
  credit: Pick<
    DomainRollbackReadiness,
    "authority" | "comparisonMode" | "rollbackStatus" | "serviceHealth" | "reasons"
  >;
  overallStatus: RollbackReadinessStatus;
  evaluatedAt: string;
};

export type EventAuditSummary = {
  status: BaselineStatus;
  pendingOutboxCount: number;
  failedOutboxCount: number;
  deadLetterOutboxCount: number;
  recentAuthorityEvents: OutboxEvent[];
  recentCertificationEvents: OutboxEvent[];
  warnings: string[];
  generatedAt: string;
};

export type ServiceWorkerObservabilitySummary = {
  status: BaselineStatus;
  appHealth: ServiceHealthStatus;
  databaseHealth: ServiceHealthStatus;
  redisHealth: ServiceHealthStatus;
  settlementServiceHealth: ServiceHealthStatus;
  ledgerServiceHealth: ServiceHealthStatus;
  creditWalletServiceHealth: ServiceHealthStatus;
  rabbitmqHealth: QueueHealthSummary["rabbitmq"];
  workerHeartbeatCount: number;
  staleWorkerCount: number;
  queueLag: OperationsMetricsSummary["lag"];
  outboxLag: Pick<
    OutboxObservabilitySummary,
    "oldestUnpublishedAgeSeconds" | "pendingCount" | "failedCount" | "deadLetterCount"
  >;
  warnings: string[];
  generatedAt: string;
};

export type AuthorityBaselineStatus = {
  settlement: AuthorityBaselineDomainStatus;
  ledger: AuthorityBaselineDomainStatus;
  credit: AuthorityBaselineDomainStatus;
  overallBaselineStatus: BaselineStatus;
  blockers: string[];
  warnings: string[];
  financialInvariants: FinancialInvariantReport;
  rollbackDrillSummary: RollbackDrillSummary;
  eventAudit: EventAuditSummary;
  serviceWorkerObservability: ServiceWorkerObservabilitySummary;
  generatedAt: string;
};
