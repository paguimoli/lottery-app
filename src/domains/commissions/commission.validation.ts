import type { ValidationResult } from "@/src/lib/validation/validation.types";
import type {
  CommissionAssignment,
  CommissionExecutionInput,
  CommissionPlan,
} from "./commission.types";

function isPercentageModel(model?: string) {
  return model === "weekly_figure_percentage" || model === "revenue_share";
}

export function validateCommissionPlan(
  plan: Partial<CommissionPlan>
): ValidationResult {
  const errors: string[] = [];

  if (!plan.name?.trim()) {
    errors.push("Commission plan name is required.");
  }

  if (!plan.model) {
    errors.push("Commission model is required.");
  }

  if (isPercentageModel(plan.model)) {
    if (plan.percentage === null || plan.percentage === undefined) {
      errors.push("Percentage is required for percentage commission models.");
    } else if (
      Number.isNaN(Number(plan.percentage)) ||
      Number(plan.percentage) < 0 ||
      Number(plan.percentage) > 100
    ) {
      errors.push("Percentage must be between 0 and 100.");
    }
  }

  if (
    plan.model === "flat_weekly_fee" &&
    (plan.flatAmount === null || plan.flatAmount === undefined)
  ) {
    errors.push("Flat amount is required for flat weekly fee plans.");
  } else if (
    plan.model === "flat_weekly_fee" &&
    Number.isNaN(Number(plan.flatAmount))
  ) {
    errors.push("Flat amount must be numeric.");
  }

  if (!plan.effectiveFrom) {
    errors.push("Effective from date is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCommissionAssignment(
  assignment: Partial<CommissionAssignment>
): ValidationResult {
  const errors: string[] = [];

  if (!assignment.accountId) {
    errors.push("Commission assignment account is required.");
  }

  if (!assignment.commissionPlanId) {
    errors.push("Commission assignment plan is required.");
  }

  if (!assignment.effectiveFrom) {
    errors.push("Commission assignment effective from date is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCommissionRun(
  run: Partial<CommissionExecutionInput>
): ValidationResult {
  const errors: string[] = [];

  if (!run.accountingPeriodId && !run.marketId) {
    errors.push("Commission run requires accounting period or market.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
