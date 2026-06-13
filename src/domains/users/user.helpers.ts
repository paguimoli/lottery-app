import type { PlatformUser } from "../auth/auth.types";
import type { UserIdentitySummary, UserNameParts } from "./user.types";

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

export function buildDisplayName(parts: UserNameParts) {
  if (parts.displayName?.trim()) {
    return parts.displayName.trim();
  }

  return [parts.firstName, parts.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => part.trim())
    .join(" ");
}

export function toUserIdentitySummary(user: PlatformUser): UserIdentitySummary {
  return {
    id: user.id,
    username: user.username,
    email: user.email || null,
    displayName: user.displayName || null,
    identityClass: user.identityClass,
    status: user.status,
    accountId: user.accountId || null,
  };
}
