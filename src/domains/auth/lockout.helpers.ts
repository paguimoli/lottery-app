import { AUTHENTICATION_EVENT_TYPES } from "./auth.constants";
import type { AuthAuditEvent } from "./auth.types";

export type LockoutPolicy = {
  failedAttemptThreshold: number;
  windowMinutes: number;
  lockoutMinutes: number;
};

export function getRecentFailedLoginEvents({
  events,
  userId,
  windowMinutes,
  now = new Date(),
}: {
  events: AuthAuditEvent[];
  userId: string;
  windowMinutes: number;
  now?: Date;
}) {
  const windowStart = now.getTime() - windowMinutes * 60 * 1000;

  return events.filter(
    (event) =>
      event.userId === userId &&
      event.eventType === AUTHENTICATION_EVENT_TYPES.LOGIN_FAILED &&
      new Date(event.createdAt).getTime() >= windowStart
  );
}

export function hasReachedLockoutThreshold({
  events,
  userId,
  policy,
  now = new Date(),
}: {
  events: AuthAuditEvent[];
  userId: string;
  policy: LockoutPolicy;
  now?: Date;
}) {
  return (
    getRecentFailedLoginEvents({
      events,
      userId,
      windowMinutes: policy.windowMinutes,
      now,
    }).length >= policy.failedAttemptThreshold
  );
}
