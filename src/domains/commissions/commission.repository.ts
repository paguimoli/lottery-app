import type {
  CommissionAssignment,
  CommissionPlan,
  CommissionRecord,
  CommissionRun,
} from "./commission.types";

export function saveCommissionPlan(
  plans: CommissionPlan[],
  plan: CommissionPlan
) {
  return [...plans, plan];
}

export function updateCommissionPlan(
  plans: CommissionPlan[],
  plan: CommissionPlan
) {
  return plans.map((createdPlan) =>
    createdPlan.id === plan.id ? plan : createdPlan
  );
}

export function deleteCommissionPlan(plans: CommissionPlan[], planId: string) {
  return plans.filter((plan) => plan.id !== planId);
}

export function saveCommissionAssignment(
  assignments: CommissionAssignment[],
  assignment: CommissionAssignment
) {
  return [...assignments, assignment];
}

export function updateCommissionAssignment(
  assignments: CommissionAssignment[],
  assignment: CommissionAssignment
) {
  return assignments.map((createdAssignment) =>
    createdAssignment.id === assignment.id ? assignment : createdAssignment
  );
}

export function saveCommissionRun(
  runs: CommissionRun[],
  run: CommissionRun
) {
  return [...runs, run];
}

export function updateCommissionRun(
  runs: CommissionRun[],
  run: CommissionRun
) {
  return runs.map((createdRun) =>
    createdRun.id === run.id ? run : createdRun
  );
}

export function saveCommissionRecords(
  records: CommissionRecord[],
  newRecords: CommissionRecord[]
) {
  return [...records, ...newRecords];
}

export function listCommissionRecordsByRunId(
  records: CommissionRecord[],
  commissionRunId: string
) {
  return records.filter((record) => record.commissionRunId === commissionRunId);
}

export function findCommissionPlanById(
  plans: CommissionPlan[],
  planId: string
) {
  return plans.find((plan) => plan.id === planId);
}

export function findCommissionAssignmentByAccountId(
  assignments: CommissionAssignment[],
  accountId: string
) {
  return assignments.find(
    (assignment) => assignment.accountId === accountId && assignment.active
  );
}
