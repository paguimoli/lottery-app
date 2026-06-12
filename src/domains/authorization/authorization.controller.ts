import {
  controllerFailure,
  controllerSuccess,
} from "@/src/lib/controller/controller.types";
import type { PlayerAccount } from "../accounts/account.types";
import type { OverrideApproval } from "../settlement/resettlement.types";
import {
  authorizeAction,
  canApproveOverrideRequest,
  canExecuteResettlementAuthorization,
} from "./authorization.service";
import type {
  AuthorizationAction,
  AuthorizationActor,
  AuthorizationContext,
} from "./authorization.types";

export function authorizeActionController({
  context,
  accounts,
  action,
}: {
  context: AuthorizationContext;
  accounts: PlayerAccount[];
  action: AuthorizationAction;
}) {
  const result = authorizeAction(context, accounts, action);

  if (!result.allowed) {
    return controllerFailure(result.errors);
  }

  return controllerSuccess(result);
}

export function canApproveOverrideController({
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
  const result = canApproveOverrideRequest({
    actor,
    accounts,
    overrideApproval,
    requestedByActorId,
  });

  if (!result.allowed) {
    return controllerFailure(result.errors);
  }

  return controllerSuccess(result);
}

export function canExecuteResettlementController({
  actor,
  accounts,
}: {
  actor: AuthorizationActor;
  accounts: PlayerAccount[];
}) {
  const result = canExecuteResettlementAuthorization({ actor, accounts });

  if (!result.allowed) {
    return controllerFailure(result.errors);
  }

  return controllerSuccess(result);
}
