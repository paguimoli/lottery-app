import type { PlayerAccount } from "../accounts/account.types";
import type { LedgerTransaction } from "../ledger/ledger.types";
import {
  calculateCommissionAmount,
  generateCommissionRecordId,
  generateCommissionRunId,
  getAgentRollup,
  getMasterRollup,
  getSuperMasterRollup,
} from "./commission.helpers";
import type {
  CommissionAssignment,
  CommissionExecutionInput,
  CommissionPlan,
  CommissionRecord,
  CommissionRollup,
  CommissionRun,
} from "./commission.types";

export function createCommissionPlanPayload(form: {
  name: string;
  model: CommissionPlan["model"];
  percentage?: string | number | null;
  flatAmount?: string | number | null;
  status: CommissionPlan["status"];
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string;
}): CommissionPlan {
  return {
    id: `COMMISSION-PLAN-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    name: form.name.trim(),
    model: form.model,
    percentage:
      form.percentage === "" ||
      form.percentage === undefined ||
      form.percentage === null
        ? null
        : Number(form.percentage),
    flatAmount:
      form.flatAmount === "" ||
      form.flatAmount === undefined ||
      form.flatAmount === null
        ? null
        : Number(form.flatAmount),
    status: form.status,
    effectiveFrom: form.effectiveFrom,
    effectiveTo: form.effectiveTo || null,
    notes: form.notes?.trim() || "",
    createdAt: new Date().toISOString(),
  };
}

export function createCommissionAssignmentPayload(form: {
  accountId: string;
  commissionPlanId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  active: boolean;
}): CommissionAssignment {
  return {
    id: `COMMISSION-ASSIGNMENT-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    accountId: form.accountId,
    commissionPlanId: form.commissionPlanId,
    effectiveFrom: form.effectiveFrom,
    effectiveTo: form.effectiveTo || null,
    active: form.active,
    createdAt: new Date().toISOString(),
  };
}

export function createCommissionRunPayload(
  input: CommissionExecutionInput
): CommissionRun {
  return {
    id: generateCommissionRunId(),
    accountingPeriodId: input.accountingPeriodId || null,
    marketId: input.marketId || null,
    status: "pending",
    startedAt: null,
    completedAt: null,
    accountCount: 0,
    totalWeeklyFigure: 0,
    totalCommission: 0,
    notes: input.notes?.trim() || "",
    createdAt: new Date().toISOString(),
  };
}

function getRollupForAccount({
  account,
  accounts,
  ledgerTransactions,
  periodStart,
  periodEnd,
}: {
  account: PlayerAccount;
  accounts: PlayerAccount[];
  ledgerTransactions: LedgerTransaction[];
  periodStart?: string | null;
  periodEnd?: string | null;
}): CommissionRollup {
  if (account.accountType === "super_master") {
    return getSuperMasterRollup({
      account,
      accounts,
      ledgerTransactions,
      periodStart,
      periodEnd,
    });
  }

  if (account.accountType === "master_agent") {
    return getMasterRollup({
      account,
      accounts,
      ledgerTransactions,
      periodStart,
      periodEnd,
    });
  }

  return getAgentRollup({
    account,
    accounts,
    ledgerTransactions,
    periodStart,
    periodEnd,
  });
}

export function calculateCommissionRollups({
  accounts,
  ledgerTransactions,
  periodStart,
  periodEnd,
}: {
  accounts: PlayerAccount[];
  ledgerTransactions: LedgerTransaction[];
  periodStart?: string | null;
  periodEnd?: string | null;
}) {
  return accounts
    .filter((account) => account.accountType !== "player")
    .map((account) =>
      getRollupForAccount({
        account,
        accounts,
        ledgerTransactions,
        periodStart,
        periodEnd,
      })
    );
}

function isAssignmentEffective({
  assignment,
  periodEnd,
}: {
  assignment: CommissionAssignment;
  periodEnd?: string | null;
}) {
  if (!assignment.active) {
    return false;
  }

  if (!periodEnd) {
    return true;
  }

  const periodEndTime = new Date(periodEnd).getTime();
  const effectiveFromTime = new Date(assignment.effectiveFrom).getTime();
  const effectiveToTime = assignment.effectiveTo
    ? new Date(assignment.effectiveTo).getTime()
    : null;

  if (Number.isNaN(periodEndTime) || Number.isNaN(effectiveFromTime)) {
    return true;
  }

  if (effectiveFromTime > periodEndTime) {
    return false;
  }

  return effectiveToTime === null || effectiveToTime >= periodEndTime;
}

function findEffectiveAssignment({
  accountId,
  assignments,
  periodEnd,
}: {
  accountId: string;
  assignments: CommissionAssignment[];
  periodEnd?: string | null;
}) {
  return assignments.find(
    (assignment) =>
      assignment.accountId === accountId &&
      isAssignmentEffective({ assignment, periodEnd })
  );
}

export function executeCommissionRun({
  input,
  accounts,
  ledgerTransactions,
  commissionPlans,
  commissionAssignments,
}: {
  input: CommissionExecutionInput;
  accounts: PlayerAccount[];
  ledgerTransactions: LedgerTransaction[];
  commissionPlans: CommissionPlan[];
  commissionAssignments: CommissionAssignment[];
}) {
  const startedAt = new Date().toISOString();
  const run = createCommissionRunPayload(input);
  const rollups = calculateCommissionRollups({
    accounts,
    ledgerTransactions,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  const records: CommissionRecord[] = [];

  for (const rollup of rollups) {
    const account = accounts.find(
      (createdAccount) => createdAccount.id === rollup.accountId
    );
    const assignment = findEffectiveAssignment({
      accountId: rollup.accountId,
      assignments: commissionAssignments,
      periodEnd: input.periodEnd,
    });
    const plan = assignment
      ? commissionPlans.find(
          (createdPlan) =>
            createdPlan.id === assignment.commissionPlanId &&
            createdPlan.status === "active"
        )
      : undefined;

    if (!plan || !account) {
      continue;
    }

    const commissionBase = rollup.totalWeeklyFigure;
    // TODO: confirm operator convention for whether commissions apply only to
    // positive house win or to the signed weekly figure.
    const commissionAmount = calculateCommissionAmount({
      plan,
      commissionBase,
    });

    records.push({
      id: generateCommissionRecordId({
        commissionRunId: run.id,
        accountId: rollup.accountId,
      }),
      commissionRunId: run.id,
      accountId: rollup.accountId,
      parentAccountId: account.parentId || null,
      commissionPlanId: plan.id,
      weeklyFigure: rollup.totalWeeklyFigure,
      commissionBase,
      commissionRate: plan.percentage ?? null,
      commissionAmount,
      status: "calculated",
      createdAt: startedAt,
    });
  }

  const completedAt = new Date().toISOString();
  const completedRun: CommissionRun = {
    ...run,
    status: "completed",
    startedAt,
    completedAt,
    accountCount: records.length,
    totalWeeklyFigure: records.reduce(
      (total, record) => total + record.weeklyFigure,
      0
    ),
    totalCommission: records.reduce(
      (total, record) => total + record.commissionAmount,
      0
    ),
  };

  return {
    run: completedRun,
    records,
    rollups,
    warnings: [
      "Tiered and hybrid commission models are placeholders until operator-specific rules are finalized.",
      "Commission payout ledger transactions are intentionally not created in this phase.",
      "Audit and integrity hooks are TODOs for a later commission hardening phase.",
    ],
  };
}
