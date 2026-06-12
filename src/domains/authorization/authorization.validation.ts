import type { ValidationResult } from "@/src/lib/validation/validation.types";
import type {
  ActorCategory,
  AuthorizationAction,
  AuthorizationActor,
  PlatformRole,
} from "./authorization.types";
import {
  AUTHORIZATION_ACTIONS,
  AUTHORIZATION_ERRORS,
} from "./authorization.types";

const ACTOR_CATEGORIES: ActorCategory[] = [
  "platform_operator",
  "hierarchy_participant",
];

const PLATFORM_ROLES: PlatformRole[] = [
  "super_admin",
  "operations_admin",
  "risk_admin",
  "settlement_admin",
  "compliance_admin",
  "support_admin",
  "read_only_auditor",
];

export function validateAuthorizationActor(
  actor?: AuthorizationActor | null
): ValidationResult {
  const errors: string[] = [];

  if (!actor) {
    return {
      valid: false,
      errors: [AUTHORIZATION_ERRORS.ACTOR_REQUIRED],
    };
  }

  if (!ACTOR_CATEGORIES.includes(actor.actorCategory)) {
    errors.push(AUTHORIZATION_ERRORS.INVALID_ACTOR_CATEGORY);
  }

  if (actor.actorCategory === "hierarchy_participant" && !actor.accountId) {
    errors.push(AUTHORIZATION_ERRORS.HIERARCHY_ACCOUNT_REQUIRED);
  }

  if (
    actor.actorCategory === "platform_operator" &&
    (!actor.platformRole || !PLATFORM_ROLES.includes(actor.platformRole))
  ) {
    errors.push(AUTHORIZATION_ERRORS.PLATFORM_ROLE_REQUIRED);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateAuthorizationAction(
  action?: AuthorizationAction | null
): ValidationResult {
  if (!action) {
    return {
      valid: false,
      errors: [AUTHORIZATION_ERRORS.ACTION_REQUIRED],
    };
  }

  if (!AUTHORIZATION_ACTIONS.includes(action)) {
    return {
      valid: false,
      errors: [AUTHORIZATION_ERRORS.INVALID_ACTION],
    };
  }

  return {
    valid: true,
    errors: [],
  };
}
