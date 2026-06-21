import { validateRollbackReadiness } from "../authority-control/authority-control.service";
import type { AuthorityDomain } from "../authority-control/authority-control.types";
import { createOutboxEvent } from "../outbox/outbox.service";
import { getPromotionDecision } from "../promotion-decision/promotion-decision.service";
import {
  assertSupportedPromotionExecutionDomain,
} from "./promotion-execution.repository";
import type {
  PromotionExecutionValidationResult,
  PromotionSimulationInput,
  RollbackSimulationInput,
  SettlementPromotionSimulation,
  SettlementRollbackSimulation,
} from "./promotion-execution.types";

export class PromotionExecutionValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PromotionExecutionValidationError";
    this.status = status;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeCorrelationId(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parsePromotionExecutionDomain(
  value: unknown
): AuthorityDomain {
  if (value === "SETTLEMENT") return "SETTLEMENT";
  if (value === "LEDGER") return "LEDGER";
  if (value === "CREDIT") return "CREDIT";

  throw new PromotionExecutionValidationError("A supported domain is required.");
}

function validationResult(
  name: string,
  passed: boolean,
  message: string
): PromotionExecutionValidationResult {
  return { name, passed, message };
}

function collectBlockers(results: PromotionExecutionValidationResult[]) {
  return results
    .filter((result) => !result.passed)
    .map((result) => result.message);
}

export async function simulateSettlementPromotion(
  input: PromotionSimulationInput
): Promise<SettlementPromotionSimulation> {
  assertSupportedPromotionExecutionDomain(input.domain);

  const correlationId = normalizeCorrelationId(input.correlationId);
  const [promotionDecision, rollbackReadiness] = await Promise.all([
    getPromotionDecision({ domain: "SETTLEMENT" }),
    validateRollbackReadiness(),
  ]);
  const settlementRollback = rollbackReadiness.settlement;
  const validationResults = [
    validationResult(
      "PROMOTION_DECISION_READY",
      promotionDecision.decision === "READY_FOR_CONTROLLED_PROMOTION",
      "Promotion decision must be READY_FOR_CONTROLLED_PROMOTION."
    ),
    validationResult(
      "DRY_RUN_APPROVAL_EXISTS",
      Boolean(promotionDecision.approvalState.dryRunApproval),
      "DRY_RUN_APPROVAL must exist."
    ),
    validationResult(
      "PROMOTION_APPROVAL_EXISTS",
      Boolean(promotionDecision.approvalState.promotionApproval),
      "PROMOTION_APPROVAL must exist."
    ),
    validationResult(
      "ROLLBACK_READY",
      promotionDecision.rollbackReadiness === "READY" &&
        settlementRollback.rollbackStatus === "READY",
      "Rollback readiness must be READY."
    ),
    validationResult(
      "AUTHORITY_MONOLITH",
      promotionDecision.currentAuthority === "MONOLITH",
      "Settlement authority must remain MONOLITH before controlled promotion."
    ),
    validationResult(
      "COMPARISON_ENABLED",
      promotionDecision.comparisonMode === "ENABLED",
      "Settlement comparison mode must be ENABLED."
    ),
    validationResult(
      "SERVICE_HEALTHY",
      settlementRollback.serviceHealth.available,
      "Settlement Service health must be available."
    ),
  ];
  const blockers = collectBlockers(validationResults);
  const warnings = [...promotionDecision.warnings];
  const simulatedAt = nowIso();
  const auditEvent = await createOutboxEvent({
    eventType: "authority.promotion.simulated",
    aggregateType: "authority_candidate",
    aggregateId: "SETTLEMENT",
    correlationId,
    payload: {
      domain: "SETTLEMENT",
      currentAuthority: promotionDecision.currentAuthority,
      proposedAuthority: "SERVICE",
      comparisonMode: promotionDecision.comparisonMode,
      rollbackReadiness: promotionDecision.rollbackReadiness,
      promotionAllowed: blockers.length === 0,
      blockers,
      warnings,
      simulatedAt,
    },
  });

  return {
    domain: "SETTLEMENT",
    currentAuthority: promotionDecision.currentAuthority,
    proposedAuthority: "SERVICE",
    comparisonMode: promotionDecision.comparisonMode,
    promotionDecision: promotionDecision.decision,
    rollbackReadiness: promotionDecision.rollbackReadiness,
    serviceHealth: settlementRollback.serviceHealth,
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

export async function simulateSettlementRollback(
  input: RollbackSimulationInput
): Promise<SettlementRollbackSimulation> {
  assertSupportedPromotionExecutionDomain(input.domain);

  const correlationId = normalizeCorrelationId(input.correlationId);
  const rollbackReadiness = await validateRollbackReadiness();
  const settlementRollback = rollbackReadiness.settlement;
  const validationResults = [
    validationResult(
      "MONOLITH_PATH_AVAILABLE",
      settlementRollback.monolithPathAvailable,
      "Monolith path must be available."
    ),
    validationResult(
      "COMPARISON_MODE_AVAILABLE",
      settlementRollback.comparisonMode === "ENABLED",
      "Comparison mode must be ENABLED."
    ),
    validationResult(
      "AUTHORITY_CONTROLS_AVAILABLE",
      settlementRollback.authority === "MONOLITH" ||
        settlementRollback.authority === "SERVICE",
      "Authority controls must be available."
    ),
    validationResult(
      "ROLLBACK_READY",
      settlementRollback.rollbackStatus === "READY",
      "Rollback readiness must be READY."
    ),
  ];
  const blockers = collectBlockers(validationResults);
  const warnings = settlementRollback.reasons.filter(
    (reason) => reason !== "Authority and rollback controls are within ready thresholds."
  );
  const simulatedAt = nowIso();
  const auditEvent = await createOutboxEvent({
    eventType: "authority.rollback.simulated",
    aggregateType: "authority_candidate",
    aggregateId: "SETTLEMENT",
    correlationId,
    payload: {
      domain: "SETTLEMENT",
      authorityState: settlementRollback.authority,
      comparisonMode: settlementRollback.comparisonMode,
      rollbackReadiness: settlementRollback.rollbackStatus,
      rollbackAllowed: blockers.length === 0,
      blockers,
      warnings,
      simulatedAt,
    },
  });

  return {
    domain: "SETTLEMENT",
    authorityState: settlementRollback.authority,
    comparisonMode: settlementRollback.comparisonMode,
    rollbackReadiness: settlementRollback.rollbackStatus,
    serviceHealth: settlementRollback.serviceHealth,
    monolithPathAvailable: settlementRollback.monolithPathAvailable,
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
