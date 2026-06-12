export type PlatformRole =
  | "super_admin"
  | "operations_admin"
  | "risk_admin"
  | "settlement_admin"
  | "compliance_admin"
  | "support_admin"
  | "read_only_auditor";

export type ActorCategory = "platform_operator" | "hierarchy_participant";

export type AuthorizationAction =
  | "account.view"
  | "account.create"
  | "account.update"
  | "account.move"
  | "account.deactivate"
  | "ledger.view"
  | "ledger.adjust"
  | "ticket.view"
  | "ticket.void"
  | "report.view"
  | "commission.view"
  | "commission.recalculate"
  | "settlement.view"
  | "settlement.execute"
  | "settlement.resettle"
  | "result.post"
  | "result.correct"
  | "result.void"
  | "override.request"
  | "override.approve"
  | "audit.view"
  | "integrity.verify"
  | "rng.configure"
  | "market.configure"
  | "admin.manage";

export type AuthorizationActor = {
  id: string;
  actorCategory: ActorCategory;
  platformRole?: PlatformRole | null;
  accountId?: string | null;
  permissions: string[];
};

export type AuthorizationContext = {
  actor: AuthorizationActor;
  targetAccountId?: string | null;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
};

export type AuthorizationResult = {
  allowed: boolean;
  errors: string[];
  scopeAccountIds?: string[];
};

export const AUTHORIZATION_ACTIONS: AuthorizationAction[] = [
  "account.view",
  "account.create",
  "account.update",
  "account.move",
  "account.deactivate",
  "ledger.view",
  "ledger.adjust",
  "ticket.view",
  "ticket.void",
  "report.view",
  "commission.view",
  "commission.recalculate",
  "settlement.view",
  "settlement.execute",
  "settlement.resettle",
  "result.post",
  "result.correct",
  "result.void",
  "override.request",
  "override.approve",
  "audit.view",
  "integrity.verify",
  "rng.configure",
  "market.configure",
  "admin.manage",
];

export const PLATFORM_ONLY_ACTIONS: AuthorizationAction[] = [
  "settlement.execute",
  "settlement.resettle",
  "result.correct",
  "result.void",
  "override.approve",
  "integrity.verify",
  "audit.view",
  "commission.recalculate",
  "rng.configure",
  "market.configure",
  "admin.manage",
];

export const AUTHORIZATION_ERRORS = {
  ACTOR_REQUIRED: "ACTOR_REQUIRED",
  ACTION_REQUIRED: "ACTION_REQUIRED",
  INVALID_ACTION: "INVALID_ACTION",
  INVALID_ACTOR_CATEGORY: "INVALID_ACTOR_CATEGORY",
  PLATFORM_ROLE_REQUIRED: "PLATFORM_ROLE_REQUIRED",
  HIERARCHY_ACCOUNT_REQUIRED: "HIERARCHY_ACCOUNT_REQUIRED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  TARGET_OUT_OF_SCOPE: "TARGET_OUT_OF_SCOPE",
  PLATFORM_ONLY_ACTION_DENIED_TO_HIERARCHY_PARTICIPANT:
    "PLATFORM_ONLY_ACTION_DENIED_TO_HIERARCHY_PARTICIPANT",
  PERMISSION_NOT_ASSIGNABLE_TO_HIERARCHY_PARTICIPANT:
    "PERMISSION_NOT_ASSIGNABLE_TO_HIERARCHY_PARTICIPANT",
  OVERRIDE_APPROVER_REQUIRED: "OVERRIDE_APPROVER_REQUIRED",
  OVERRIDE_DUAL_CONTROL_REQUIRED: "OVERRIDE_DUAL_CONTROL_REQUIRED",
} as const;
