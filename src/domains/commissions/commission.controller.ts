import {
  controllerFailure,
  controllerSuccess,
} from "@/src/lib/controller/controller.types";
import type { PlayerAccount } from "../accounts/account.types";
import type { LedgerTransaction } from "../ledger/ledger.types";
import {
  deleteCommissionPlan,
  saveCommissionAssignment,
  saveCommissionPlan,
  saveCommissionRecords,
  saveCommissionRun,
  updateCommissionAssignment,
  updateCommissionPlan,
} from "./commission.repository";
import {
  createCommissionAssignmentPayload,
  createCommissionPlanPayload,
  createCommissionRunPayload,
  executeCommissionRun,
} from "./commission.service";
import type {
  CommissionAssignment,
  CommissionExecutionInput,
  CommissionPlan,
  CommissionRecord,
  CommissionRun,
} from "./commission.types";
import {
  validateCommissionAssignment,
  validateCommissionPlan,
  validateCommissionRun,
} from "./commission.validation";

export function createCommissionPlanController({
  form,
  plans,
}: {
  form: Parameters<typeof createCommissionPlanPayload>[0];
  plans: CommissionPlan[];
}) {
  const plan = createCommissionPlanPayload(form);
  const validation = validateCommissionPlan(plan);

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  return controllerSuccess({
    plan,
    plans: saveCommissionPlan(plans, plan),
  });
}

export function updateCommissionPlanController({
  plan,
  plans,
}: {
  plan: CommissionPlan;
  plans: CommissionPlan[];
}) {
  const validation = validateCommissionPlan(plan);

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  return controllerSuccess({
    plan,
    plans: updateCommissionPlan(plans, plan),
  });
}

export function deleteCommissionPlanController({
  planId,
  plans,
}: {
  planId: string;
  plans: CommissionPlan[];
}) {
  return controllerSuccess({
    plans: deleteCommissionPlan(plans, planId),
  });
}

export function createCommissionAssignmentController({
  form,
  assignments,
}: {
  form: Parameters<typeof createCommissionAssignmentPayload>[0];
  assignments: CommissionAssignment[];
}) {
  const assignment = createCommissionAssignmentPayload(form);
  const validation = validateCommissionAssignment(assignment);

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  return controllerSuccess({
    assignment,
    assignments: saveCommissionAssignment(assignments, assignment),
  });
}

export function updateCommissionAssignmentController({
  assignment,
  assignments,
}: {
  assignment: CommissionAssignment;
  assignments: CommissionAssignment[];
}) {
  const validation = validateCommissionAssignment(assignment);

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  return controllerSuccess({
    assignment,
    assignments: updateCommissionAssignment(assignments, assignment),
  });
}

export function createCommissionRunController({
  input,
  runs,
}: {
  input: CommissionExecutionInput;
  runs: CommissionRun[];
}) {
  const validation = validateCommissionRun(input);

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const run = createCommissionRunPayload(input);

  return controllerSuccess({
    run,
    runs: saveCommissionRun(runs, run),
  });
}

export function executeCommissionRunController({
  input,
  accounts,
  ledgerTransactions,
  commissionPlans,
  commissionAssignments,
  commissionRuns,
  commissionRecords,
}: {
  input: CommissionExecutionInput;
  accounts: PlayerAccount[];
  ledgerTransactions: LedgerTransaction[];
  commissionPlans: CommissionPlan[];
  commissionAssignments: CommissionAssignment[];
  commissionRuns: CommissionRun[];
  commissionRecords: CommissionRecord[];
}) {
  // TODO Phase 5.10 integration: require commission.recalculate authorization
  // before system-wide commission recalculation once actor context is available.
  const validation = validateCommissionRun(input);

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const execution = executeCommissionRun({
    input,
    accounts,
    ledgerTransactions,
    commissionPlans,
    commissionAssignments,
  });

  return controllerSuccess({
    ...execution,
    commissionRuns: saveCommissionRun(commissionRuns, execution.run),
    commissionRecords: saveCommissionRecords(
      commissionRecords,
      execution.records
    ),
  });
}
