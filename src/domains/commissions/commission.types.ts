export type CommissionModel =
  | "revenue_share"
  | "weekly_figure_percentage"
  | "tiered_percentage"
  | "flat_weekly_fee"
  | "hybrid";

export type CommissionPlanStatus = "active" | "inactive" | "archived";

export type CommissionPlan = {
  id: string;
  name: string;
  model: CommissionModel;
  percentage?: number | null;
  flatAmount?: number | null;
  status: CommissionPlanStatus;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string;
  createdAt: string;
};

export type CommissionAssignment = {
  id: string;
  accountId: string;
  commissionPlanId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  active: boolean;
  createdAt: string;
};

export type CommissionRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type CommissionRun = {
  id: string;
  accountingPeriodId?: string | null;
  marketId?: string | null;
  status: CommissionRunStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  accountCount: number;
  totalWeeklyFigure: number;
  totalCommission: number;
  notes?: string;
  createdAt: string;
};

export type CommissionRecord = {
  id: string;
  commissionRunId: string;
  accountId: string;
  parentAccountId?: string | null;
  commissionPlanId?: string | null;
  weeklyFigure: number;
  commissionBase: number;
  commissionRate?: number | null;
  commissionAmount: number;
  status: "calculated" | "void" | "adjusted";
  createdAt: string;
};

export type CommissionRollup = {
  accountId: string;
  directWeeklyFigure: number;
  downlineWeeklyFigure: number;
  totalWeeklyFigure: number;
  pendingExposure: number;
};

export type CommissionExecutionInput = {
  accountingPeriodId?: string | null;
  marketId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  notes?: string;
};
