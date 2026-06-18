import {
  type SettlementEvaluationInput,
  type SettlementEvaluationResult,
} from "./evaluators/settlement-evaluator.types";
import { evaluateTicketLine } from "./settlement-evaluator-router.service";

export { evaluateTicketLine } from "./settlement-evaluator-router.service";

export function evaluateTicketLines(
  inputs: SettlementEvaluationInput[]
): SettlementEvaluationResult[] {
  return inputs.map((input) => evaluateTicketLine(input));
}

export {
  executeSettlementRun,
  type SettlementExecutionError,
  type SettlementExecutionInput,
  type SettlementExecutionResult,
  type SettlementExecutionSummary,
} from "./settlement-executor.service";

export {
  canResumeSettlementRun,
  generateSettlementExecutionId,
  getIncompleteSettlementRuns,
  hasExistingSettlementRecord,
  isSettlementRunComplete,
  resumeSettlementRun,
} from "./settlement-recovery.service";

export {
  applySettlementLedgerEffects,
  type SettlementLedgerEffectCommand,
  type SettlementLedgerEffectResult,
} from "./settlement-financial-effects.service";

export {
  applyCreditSettlementForRecord,
  applyCreditSettlementForRecords,
  type ApplyCreditSettlementForRecordInput,
  type ApplyCreditSettlementForRecordsInput,
  type SettlementCreditApplicationResult,
  type SettlementCreditApplicationStatus,
} from "./settlement-credit.service";

export { executeResettlementController } from "./resettlement.controller";

export {
  createCorrectedSettlementRecords,
  createSettlementReversalRecords,
  executeResettlement,
} from "./resettlement.service";

export {
  RESETTLEMENT_ACTION_TYPE,
  validateResettlementEligibility,
} from "./resettlement.validation";

export type {
  AccountingPeriod,
  AccountingPeriodStatus,
  OverrideApproval,
  OverrideApprovalStatus,
  ResettlementEligibilityResult,
  ResettlementExecutionInput,
  ResettlementExecutionResult,
} from "./resettlement.types";
