import {
  getAuthorityStatus,
  validateRollbackReadiness,
} from "../authority-control/authority-control.service";
import { createOutboxEvent } from "../outbox/outbox.service";
import { getPromotionDecision } from "../promotion-decision/promotion-decision.service";
import {
  getShadowAnalysisSummary,
  listShadowAnalysisFailures,
  listShadowAnalysisMismatches,
} from "../shadow-analysis/shadow-analysis.service";
import type { ClassifiedShadowEvidence } from "../shadow-analysis/shadow-analysis.types";
import {
  getCreditShadowMismatches,
  getCreditShadowSummary,
} from "../credit-shadow/credit-shadow-reporting.service";
import { listCreditAuthorityApprovalRecords } from "./credit-authority.repository";
import type {
  CreditAuthorityCandidateStatus,
  CreditAuthorityDryRunMode,
  CreditAuthorityMetrics,
  CreditAuthorityReadiness,
  CreditAuthorityRuntimeRoute,
  CreditDryRunEvaluation,
  CreditRollbackTriggerEvaluation,
  CreditSimulationResult,
} from "./credit-authority.types";

function nowIso() {
  return new Date().toISOString();
}

function getNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) ? value : fallback;
}

function getDryRunMode(): CreditAuthorityDryRunMode {
  return process.env.CREDIT_AUTHORITY_DRY_RUN_MODE === "ENABLED"
    ? "ENABLED"
    : "DISABLED";
}

function rate(part: number, total: number) {
  if (total === 0) return 0;

  return Number((part / total).toFixed(6));
}

function maxStatus(
  statuses: CreditAuthorityCandidateStatus[]
): CreditAuthorityCandidateStatus {
  if (statuses.includes("BLOCKED")) return "BLOCKED";
  if (statuses.includes("WARNING")) return "WARNING";

  return "READY";
}

function getThresholds() {
  return {
    mismatchAlertThreshold: getNumberEnv("CREDIT_MISMATCH_ALERT_THRESHOLD", 0.001),
    rollbackFailureThreshold: getNumberEnv(
      "CREDIT_ROLLBACK_FAILURE_THRESHOLD",
      0.001
    ),
  };
}

function validationResult(name: string, passed: boolean, message: string) {
  return { name, passed, message };
}

function collectBlockers(
  results: Array<{ name: string; passed: boolean; message: string }>
) {
  return results.filter((result) => !result.passed).map((result) => result.message);
}

function normalizeCorrelationId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function resolveCreditAuthorityRoute(): Promise<CreditAuthorityRuntimeRoute> {
  const authority = getAuthorityStatus().credit;
  const dryRunMode = getDryRunMode();
  const reasons: string[] = [];

  reasons.push(
    authority.authority === "MONOLITH"
      ? "Monolith credit wallet remains authoritative."
      : "Credit Wallet Service is configured as authoritative."
  );

  if (authority.comparisonMode === "ENABLED") {
    reasons.push(
      authority.authority === "SERVICE"
        ? "Monolith credit wallet remains available for comparison."
        : "Credit Wallet Service remains available for comparison."
    );
  } else {
    reasons.push("Credit comparison mode is disabled.");
  }

  if (dryRunMode === "ENABLED") {
    reasons.push("Credit authority dry-run mode is enabled.");
  }

  return {
    authoritativePath: authority.authority,
    comparisonMode: authority.comparisonMode,
    comparisonPath:
      authority.comparisonMode === "ENABLED"
        ? authority.authority === "SERVICE"
          ? "MONOLITH"
          : "CREDIT_SERVICE"
        : null,
    dryRunMode,
    productionCutoverActive: authority.authority === "SERVICE",
    reasons,
  };
}

async function getMetrics(): Promise<CreditAuthorityMetrics> {
  const [summary, mismatches] = await Promise.all([
    getCreditShadowSummary(),
    getCreditShadowMismatches({ limit: 10000 }),
  ]);
  const totalEvents = summary.totalRuns + summary.failures;

  return {
    totalRuns: summary.totalRuns,
    matches: summary.matches,
    mismatches: summary.mismatches,
    failures: summary.failures,
    mismatchRate: rate(summary.mismatches, totalEvents),
    failureRate: rate(summary.failures, totalEvents),
    criticalMismatchPresent: mismatches.some(
      (mismatch) => mismatch.severity === "CRITICAL"
    ),
    shadowReadinessStatus: summary.readiness.status,
  };
}

function evaluateRollbackTrigger({
  metrics,
  rollbackReadinessStatus,
  authority,
}: {
  metrics: CreditAuthorityMetrics | null;
  rollbackReadinessStatus: CreditAuthorityCandidateStatus;
  authority: ReturnType<typeof getAuthorityStatus>["credit"];
}): CreditRollbackTriggerEvaluation {
  const thresholds = getThresholds();
  const reasons: string[] = [];

  if (!metrics) {
    return {
      shouldTriggerRollback: false,
      status: "WARNING",
      reasons: ["Credit shadow metrics are unavailable."],
    };
  }

  if (metrics.criticalMismatchPresent) {
    reasons.push("Critical credit shadow mismatches are present.");
  }
  if (metrics.mismatchRate >= thresholds.mismatchAlertThreshold) {
    reasons.push("Credit mismatch rate is at or above alert threshold.");
  }
  if (metrics.failureRate >= thresholds.rollbackFailureThreshold) {
    reasons.push("Credit shadow failure rate is at or above rollback threshold.");
  }
  if (rollbackReadinessStatus === "BLOCKED") {
    reasons.push("Credit rollback readiness is blocked.");
  }

  const shouldTriggerRollback =
    authority.authority === "SERVICE" && reasons.length > 0;

  if (!shouldTriggerRollback && reasons.length === 0) {
    reasons.push("No automatic credit rollback trigger is active.");
  }

  return {
    shouldTriggerRollback,
    status: shouldTriggerRollback ? "BLOCKED" : reasons.length > 0 ? "WARNING" : "READY",
    reasons,
  };
}

export async function getCreditAuthorityReadiness(): Promise<CreditAuthorityReadiness> {
  const authorityStatus = getAuthorityStatus();
  const creditAuthority = authorityStatus.credit;
  const route = await resolveCreditAuthorityRoute();
  const rollbackReadiness = await validateRollbackReadiness();
  const rollbackReadinessStatus = rollbackReadiness.credit.rollbackStatus;
  const thresholds = getThresholds();
  const readinessReasons: string[] = [];
  const remainingBlockers: string[] = [];
  let metrics: CreditAuthorityMetrics | null = null;

  try {
    metrics = await getMetrics();
  } catch (error) {
    remainingBlockers.push(
      error instanceof Error ? error.message : "Credit shadow metrics are unavailable."
    );
  }

  if (creditAuthority.authority !== "MONOLITH") {
    remainingBlockers.push("Credit authority is not MONOLITH.");
  } else {
    readinessReasons.push("Credit authority remains MONOLITH.");
  }

  if (creditAuthority.comparisonMode !== "ENABLED") {
    remainingBlockers.push("Credit comparison mode is disabled.");
  } else {
    readinessReasons.push("Credit comparison mode is enabled.");
  }

  if (rollbackReadinessStatus === "BLOCKED") {
    remainingBlockers.push("Credit rollback readiness is blocked.");
  } else {
    readinessReasons.push(`Credit rollback readiness is ${rollbackReadinessStatus}.`);
  }

  if (metrics) {
    if (metrics.criticalMismatchPresent) {
      remainingBlockers.push("Critical credit mismatches are present.");
    }
    if (metrics.mismatchRate >= thresholds.mismatchAlertThreshold) {
      remainingBlockers.push("Credit mismatch threshold is exceeded.");
    }
    readinessReasons.push(`Credit shadow readiness is ${metrics.shadowReadinessStatus}.`);
  }

  readinessReasons.push(
    route.dryRunMode === "ENABLED"
      ? "Credit authority dry-run mode is enabled."
      : "Credit authority dry-run mode is disabled."
  );

  const rollbackTrigger = evaluateRollbackTrigger({
    metrics,
    rollbackReadinessStatus,
    authority: creditAuthority,
  });
  const status = maxStatus([
    remainingBlockers.length > 0 ? "BLOCKED" : "READY",
    rollbackTrigger.status,
    metrics?.shadowReadinessStatus ?? "WARNING",
  ]);

  return {
    status,
    authority: creditAuthority.authority,
    comparisonMode: creditAuthority.comparisonMode,
    dryRunMode: route.dryRunMode,
    runtimeRoute: route,
    metrics,
    thresholds,
    rollbackReadinessStatus,
    rollbackTrigger,
    readinessReasons,
    remainingBlockers,
    evaluatedAt: nowIso(),
  };
}

function approvalRequirements({
  hasDryRunApproval,
  hasPromotionApproval,
}: {
  hasDryRunApproval: boolean;
  hasPromotionApproval: boolean;
}) {
  const requirements: string[] = [];

  if (!hasDryRunApproval) {
    requirements.push("DRY_RUN_APPROVAL is required before credit dry-run activation.");
  }
  if (!hasPromotionApproval) {
    requirements.push("PROMOTION_APPROVAL is required before credit authority promotion.");
  }
  requirements.push("ROLLBACK_APPROVAL is required before any future credit rollback action.");

  return requirements;
}

function latestApproval(
  approvals: Awaited<ReturnType<typeof listCreditAuthorityApprovalRecords>>,
  approvalType: "DRY_RUN_APPROVAL" | "PROMOTION_APPROVAL" | "ROLLBACK_APPROVAL"
) {
  return approvals.find((approval) => approval.approvalType === approvalType) ?? null;
}

function lifecycleParticipatesInRollback(evidence: ClassifiedShadowEvidence) {
  return (
    evidence.lifecycleStatus === "ACTIVE" ||
    evidence.lifecycleStatus === "REVIEW_REQUIRED"
  );
}

function getPostPromotionEvidenceSummary(
  domainEvidence: Awaited<ReturnType<typeof getShadowAnalysisSummary>>["domains"]["credit"]
) {
  return {
    totalRuns: 0,
    matches: 0,
    mismatches: 0,
    failures: 0,
    criticalMismatchCount: 0,
    readiness: domainEvidence.promotionReadiness.readinessStatus,
  };
}

export async function getCreditDryRunEvaluation(): Promise<CreditDryRunEvaluation> {
  const [promotionDecision, approvals, shadowAnalysis] = await Promise.all([
    getPromotionDecision({ domain: "CREDIT" }),
    listCreditAuthorityApprovalRecords(),
    getShadowAnalysisSummary("all"),
  ]);
  const wouldThresholdsBeExceeded =
    promotionDecision.promotionReadiness.readiness !== "READY";
  const wouldRollbackTrigger =
    promotionDecision.decision === "ROLLBACK_RECOMMENDED" ||
    promotionDecision.blockingReasons.length > 0;

  return {
    authorityCandidate: "CREDIT",
    currentState: promotionDecision.decision,
    ifServiceBecameAuthoritativeNow: {
      wouldRollbackTrigger,
      wouldThresholdsBeExceeded,
      wouldPromotionBeAllowed:
        promotionDecision.decision === "READY_FOR_CONTROLLED_PROMOTION" &&
        !wouldRollbackTrigger &&
        !wouldThresholdsBeExceeded,
    },
    rawEvidence: {
      readiness: promotionDecision.rawReadiness.readiness,
      mismatchRate: promotionDecision.rawReadiness.mismatchRate,
      failureRate: promotionDecision.rawReadiness.failureRate,
    },
    adjustedEvidence: {
      readiness: promotionDecision.adjustedReadiness.readiness,
      mismatchRate: promotionDecision.adjustedReadiness.mismatchRate,
      failureRate: promotionDecision.adjustedReadiness.failureRate,
    },
    promotionEvidence: {
      readiness: promotionDecision.promotionReadiness.readiness,
      mismatchRate: promotionDecision.promotionReadiness.mismatchRate,
      failureRate: promotionDecision.promotionReadiness.failureRate,
    },
    postPromotionEvidence: getPostPromotionEvidenceSummary(
      shadowAnalysis.domains.credit
    ),
    rollbackReadiness: promotionDecision.rollbackReadiness,
    promotionBlockers: promotionDecision.blockingReasons,
    approvalRequirements: approvalRequirements({
      hasDryRunApproval: Boolean(latestApproval(approvals, "DRY_RUN_APPROVAL")),
      hasPromotionApproval: Boolean(latestApproval(approvals, "PROMOTION_APPROVAL")),
    }),
    evaluatedAt: nowIso(),
  };
}

function creditRollbackReadiness(summary: Awaited<ReturnType<typeof validateRollbackReadiness>>) {
  return summary.credit;
}

export async function simulateCreditPromotion({
  actorUserId,
  correlationId,
}: {
  actorUserId?: string | null;
  correlationId?: unknown;
} = {}): Promise<CreditSimulationResult> {
  const normalizedCorrelationId = normalizeCorrelationId(correlationId);
  const [promotionDecision, rollbackReadiness] = await Promise.all([
    getPromotionDecision({ domain: "CREDIT" }),
    validateRollbackReadiness(),
  ]);
  const creditRollback = creditRollbackReadiness(rollbackReadiness);
  const validationResults = [
    validationResult(
      "PROMOTION_DECISION_READY",
      promotionDecision.decision === "READY_FOR_CONTROLLED_PROMOTION",
      "Credit promotion decision must be READY_FOR_CONTROLLED_PROMOTION."
    ),
    validationResult(
      "DRY_RUN_APPROVAL_EXISTS",
      Boolean(promotionDecision.approvalState.dryRunApproval),
      "Credit DRY_RUN_APPROVAL must exist."
    ),
    validationResult(
      "PROMOTION_APPROVAL_EXISTS",
      Boolean(promotionDecision.approvalState.promotionApproval),
      "Credit PROMOTION_APPROVAL must exist."
    ),
    validationResult(
      "ROLLBACK_READY",
      promotionDecision.rollbackReadiness === "READY" &&
        creditRollback.rollbackStatus === "READY",
      "Credit rollback readiness must be READY."
    ),
    validationResult(
      "AUTHORITY_MONOLITH",
      promotionDecision.currentAuthority === "MONOLITH",
      "Credit authority must remain MONOLITH before controlled promotion."
    ),
    validationResult(
      "COMPARISON_ENABLED",
      promotionDecision.comparisonMode === "ENABLED",
      "Credit comparison mode must be ENABLED."
    ),
    validationResult(
      "SERVICE_HEALTHY",
      creditRollback.serviceHealth.available,
      "Credit Wallet Service health must be available."
    ),
  ];
  const blockers = collectBlockers(validationResults);
  const warnings = [...promotionDecision.warnings];
  const simulatedAt = nowIso();
  const auditEvent = await createOutboxEvent({
    eventType: "authority.credit.promotion.simulated",
    aggregateType: "authority_candidate",
    aggregateId: "CREDIT",
    correlationId: normalizedCorrelationId,
    payload: {
      domain: "CREDIT",
      actorUserId: actorUserId ?? null,
      currentAuthority: promotionDecision.currentAuthority,
      proposedAuthority: "SERVICE",
      simulatedAuthority: "SERVICE",
      comparisonMode: promotionDecision.comparisonMode,
      decision: promotionDecision.decision,
      rollbackReadiness: promotionDecision.rollbackReadiness,
      rollbackReady:
        promotionDecision.rollbackReadiness === "READY" &&
        creditRollback.rollbackStatus === "READY",
      promotionAllowed: blockers.length === 0,
      blockers,
      warnings,
      timestamp: simulatedAt,
      simulatedAt,
    },
  });

  return {
    domain: "CREDIT",
    currentAuthority: promotionDecision.currentAuthority,
    proposedAuthority: "SERVICE",
    simulatedAuthority: "SERVICE",
    comparisonMode: promotionDecision.comparisonMode,
    promotionDecision: promotionDecision.decision,
    rollbackReadiness: promotionDecision.rollbackReadiness,
    rollbackReady:
      promotionDecision.rollbackReadiness === "READY" &&
      creditRollback.rollbackStatus === "READY",
    serviceHealth: creditRollback.serviceHealth,
    validationResults,
    blockers,
    warnings,
    promotionAllowed: blockers.length === 0,
    auditEvent: {
      id: auditEvent.id,
      eventType: auditEvent.eventType,
      correlationId: auditEvent.correlationId ?? null,
    },
    simulatedAt,
  };
}

export async function simulateCreditRollback({
  actorUserId,
  correlationId,
}: {
  actorUserId?: string | null;
  correlationId?: unknown;
} = {}): Promise<CreditSimulationResult> {
  const normalizedCorrelationId = normalizeCorrelationId(correlationId);
  const [rollbackReadiness, promotionDecision, mismatches, failures] =
    await Promise.all([
      validateRollbackReadiness(),
      getPromotionDecision({ domain: "CREDIT" }),
      listShadowAnalysisMismatches("all"),
      listShadowAnalysisFailures("all"),
    ]);
  const creditRollback = creditRollbackReadiness(rollbackReadiness);
  const activeCreditEvidence = [...mismatches, ...failures].filter(
    (evidence) =>
      evidence.domain === "CREDIT" && lifecycleParticipatesInRollback(evidence)
  );
  const validationResults = [
    validationResult(
      "MONOLITH_PATH_AVAILABLE",
      creditRollback.monolithPathAvailable,
      "Credit monolith path must be available."
    ),
    validationResult(
      "COMPARISON_MODE_AVAILABLE",
      creditRollback.comparisonMode === "ENABLED",
      "Credit comparison mode must be ENABLED."
    ),
    validationResult(
      "AUTHORITY_CONTROLS_AVAILABLE",
      creditRollback.authority === "MONOLITH" || creditRollback.authority === "SERVICE",
      "Credit authority controls must be available."
    ),
    validationResult(
      "ROLLBACK_READY",
      creditRollback.rollbackStatus === "READY",
      "Credit rollback readiness must be READY."
    ),
    validationResult(
      "NO_ACTIVE_PROMOTION_EVIDENCE_BLOCKERS",
      activeCreditEvidence.length === 0,
      "Credit lifecycle-effective rollback evidence must be clear."
    ),
  ];
  const blockers = collectBlockers(validationResults);
  const warnings = creditRollback.reasons.filter(
    (reason) => reason !== "Authority and rollback controls are within ready thresholds."
  );
  const simulatedAt = nowIso();
  const auditEvent = await createOutboxEvent({
    eventType: "authority.credit.rollback.simulated",
    aggregateType: "authority_candidate",
    aggregateId: "CREDIT",
    correlationId: normalizedCorrelationId,
    payload: {
      domain: "CREDIT",
      actorUserId: actorUserId ?? null,
      authorityState: creditRollback.authority,
      comparisonMode: creditRollback.comparisonMode,
      decision: promotionDecision.decision,
      rollbackReadiness: creditRollback.rollbackStatus,
      rollbackReady: creditRollback.rollbackStatus === "READY",
      rollbackAllowed: blockers.length === 0,
      blockers,
      warnings,
      timestamp: simulatedAt,
      simulatedAt,
    },
  });

  return {
    domain: "CREDIT",
    authorityState: creditRollback.authority,
    simulatedAuthority: "MONOLITH",
    comparisonMode: creditRollback.comparisonMode,
    rollbackReadiness: creditRollback.rollbackStatus,
    rollbackReady: creditRollback.rollbackStatus === "READY",
    serviceHealth: creditRollback.serviceHealth,
    validationResults,
    blockers,
    warnings,
    rollbackAllowed: blockers.length === 0,
    auditEvent: {
      id: auditEvent.id,
      eventType: auditEvent.eventType,
      correlationId: auditEvent.correlationId ?? null,
    },
    simulatedAt,
  };
}
