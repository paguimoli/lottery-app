import { SESSION_STATUSES } from "./auth.constants";
import type { SessionStatus, UserSession } from "./auth.types";

export function isSessionStatus(value: string): value is SessionStatus {
  return Object.values(SESSION_STATUSES).includes(value as SessionStatus);
}

export function isSessionExpired(
  session: Pick<UserSession, "expiresAt">,
  now = new Date()
) {
  return new Date(session.expiresAt).getTime() <= now.getTime();
}

export function isSessionActive(session?: UserSession | null, now = new Date()) {
  return (
    session?.status === SESSION_STATUSES.ACTIVE &&
    !isSessionExpired(session, now)
  );
}

export function getActiveSessions(sessions: UserSession[], now = new Date()) {
  return sessions.filter((session) => isSessionActive(session, now));
}
