import type { PlayerAccount } from "../accounts/account.types";
import type { OverrideApproval } from "../settlement/resettlement.types";
import {
  actorHasPermission,
  getVisibleAccountIdsForActor,
  isAccountInActorScope,
  isPermissionAssignableToActorCategory,
  isPlatformOnlyAction,
} from "./authorization.helpers";
import type {
  AuthorizationAction,
  AuthorizationActor,
  AuthorizationContext,
  AuthorizationResult,
} from "./authorization.types";
import { AUTHORIZATION_ERRORS } from "./authorization.types";
import {
  validateAuthorizationAction,
  validateAuthorizationActor,
} from "./authorization.validation";

function allowed(scopeAccountIds?: string[]): AuthorizationResult {
  return {
    allowed: true,
    errors: [],
    scopeAccountIds,
  };
}

function denied(errors: string[], scopeAccountIds?: string[]): AuthorizationResult {
  return {
    allowed: false,
    errors,
    scopeAccountIds,
  };
}

export function authorizeAction(
  context: AuthorizationContext,
  accounts: PlayerAccount[],
  action: AuthorizationAction
): AuthorizationResult {
  const actorValidation = validateAuthorizationActor(context.actor);
  const actionValidation = validateAuthorizationAction(action);
  const scopeAccountIds = context.actor
    ? getVisibleAccountIdsForActor({ actor: context.actor, accounts })
    : [];

  if (!actorValidation.valid || !actionValidation.valid) {
    return denied(
      [...actorValidation.errors, ...actionValidation.errors],
      scopeAccountIds
    );
  }

  if (
    context.actor.actorCategory === "hierarchy_participant" &&
    isPlatformOnlyAction(action)
  ) {
    // Governance-level Super Master authority should be represented as a
    // platform_operator actor, not as a financial hierarchy participant.
    return denied(
      [AUTHORIZATION_ERRORS.PLATFORM_ONLY_ACTION_DENIED_TO_HIERARCHY_PARTICIPANT],
      scopeAccountIds
    );
  }

  if (!actorHasPermission({ actor: context.actor, action })) {
    return denied([AUTHORIZATION_ERRORS.PERMISSION_DENIED], scopeAccountIds);
  }

  if (
    context.targetAccountId &&
    !isAccountInActorScope({
      actor: context.actor,
      accounts,
      targetAccountId: context.targetAccountId,
    })
  ) {
    return denied([AUTHORIZATION_ERRORS.TARGET_OUT_OF_SCOPE], scopeAccountIds);
  }

  return allowed(scopeAccountIds);
}

function checkAction(
  action: AuthorizationAction,
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return authorizeAction(context, accounts, action);
}

export function canViewAccount(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("account.view", context, accounts);
}

export function canCreateAccount(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("account.create", context, accounts);
}

export function canEditAccount(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("account.update", context, accounts);
}

export function canMoveAccount(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("account.move", context, accounts);
}

export function canDeactivateAccount(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("account.deactivate", context, accounts);
}

export function canViewLedger(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("ledger.view", context, accounts);
}

export function canCreateLedgerAdjustment(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("ledger.adjust", context, accounts);
}

export function canViewTickets(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("ticket.view", context, accounts);
}

export function canVoidTicket(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("ticket.void", context, accounts);
}

export function canViewCommission(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("commission.view", context, accounts);
}

export function canRecalculateCommission(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("commission.recalculate", context, accounts);
}

export function canViewSettlement(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("settlement.view", context, accounts);
}

export function canExecuteSettlement(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("settlement.execute", context, accounts);
}

export function canExecuteResettlement(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("settlement.resettle", context, accounts);
}

export function canPostResult(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("result.post", context, accounts);
}

export function canCorrectResult(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("result.correct", context, accounts);
}

export function canVoidResult(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("result.void", context, accounts);
}

export function canRequestOverride(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("override.request", context, accounts);
}

export function canApproveOverride(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("override.approve", context, accounts);
}

export function canViewAudit(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("audit.view", context, accounts);
}

export function canVerifyIntegrity(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("integrity.verify", context, accounts);
}

export function canConfigureRng(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("rng.configure", context, accounts);
}

export function canConfigureMarket(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("market.configure", context, accounts);
}

export function canManageAdmins(
  context: AuthorizationContext,
  accounts: PlayerAccount[]
) {
  return checkAction("admin.manage", context, accounts);
}

export function canApproveOverrideRequest({
  actor,
  accounts,
  overrideApproval,
  requestedByActorId,
}: {
  actor: AuthorizationActor;
  accounts: PlayerAccount[];
  overrideApproval?: OverrideApproval | null;
  requestedByActorId: string;
}) {
  const result = authorizeAction(
    {
      actor,
      targetEntityType: overrideApproval?.entityType || null,
      targetEntityId: overrideApproval?.entityId || null,
    },
    accounts,
    "override.approve"
  );

  if (!result.allowed) {
    return result;
  }

  if (actor.id === requestedByActorId) {
    return denied(
      [AUTHORIZATION_ERRORS.OVERRIDE_DUAL_CONTROL_REQUIRED],
      result.scopeAccountIds
    );
  }

  return result;
}

export function canExecuteResettlementAuthorization({
  actor,
  accounts,
}: {
  actor: AuthorizationActor;
  accounts: PlayerAccount[];
}) {
  return authorizeAction({ actor }, accounts, "settlement.resettle");
}

export function validatePermissionAssignment({
  actorCategory,
  permission,
}: {
  actorCategory: AuthorizationActor["actorCategory"];
  permission: AuthorizationAction;
}) {
  return isPermissionAssignableToActorCategory({
    actorCategory,
    permission,
  });
}
