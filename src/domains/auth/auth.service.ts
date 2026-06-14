import { USER_STATUSES } from "./auth.constants";
import {
  findSessionByTokenHash,
  findUserByUsername,
  revokeActiveSessionsForUser,
  revokeSessionById,
  saveUserSession,
} from "./auth.repository";
import type {
  AuthRequestMetadata,
  LoginRequestInput,
  LoginResponse,
  LogoutRequestInput,
  LogoutResponse,
} from "./auth.types";
import { hashPassword, verifyPassword } from "./password.helpers";
import {
  createSessionExpiry,
  generateSessionToken,
  hashSessionToken,
  isSessionActive,
  verifySessionToken,
} from "./session.helpers";
import { allowsMultipleActiveSessions } from "./session.policy";

const INVALID_CREDENTIALS_ERROR = "Invalid credentials.";
const PASSWORD_WORK_FACTOR_PLACEHOLDER = "invalid-password-placeholder";

export async function recordFailedLoginAttempt(): Promise<void> {
  return;
}

export async function resetFailedLoginAttempts(): Promise<void> {
  return;
}

async function performPasswordWork(password: string): Promise<void> {
  await hashPassword(password || PASSWORD_WORK_FACTOR_PLACEHOLDER);
}

function loginFailure(): LoginResponse {
  return {
    success: false,
    error: INVALID_CREDENTIALS_ERROR,
  };
}

export async function loginWithPassword({
  input,
  metadata,
}: {
  input: LoginRequestInput;
  metadata?: AuthRequestMetadata;
}): Promise<LoginResponse> {
  const user = await findUserByUsername(input.username);

  if (!user) {
    await performPasswordWork(input.password);
    await recordFailedLoginAttempt();
    return loginFailure();
  }

  const passwordHash = user.passwordHash;
  const isActive = user.status === USER_STATUSES.ACTIVE;

  if (!isActive || !passwordHash) {
    await performPasswordWork(input.password);
    await recordFailedLoginAttempt();
    return loginFailure();
  }

  const passwordMatches = await verifyPassword(input.password, passwordHash);

  if (!passwordMatches) {
    await recordFailedLoginAttempt();
    return loginFailure();
  }

  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = createSessionExpiry(user.identityClass, now);
  const sessionToken = generateSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);

  if (!allowsMultipleActiveSessions(user.identityClass)) {
    await revokeActiveSessionsForUser(user.id, createdAt);
  }

  await saveUserSession({
    userId: user.id,
    sessionTokenHash,
    ipAddress: metadata?.ipAddress ?? null,
    userAgent: metadata?.userAgent ?? null,
    createdAt,
    lastSeenAt: createdAt,
    expiresAt,
  });

  await resetFailedLoginAttempts();

  return {
    success: true,
    sessionToken,
    expiresAt,
  };
}

export async function logoutSession({
  input,
}: {
  input: LogoutRequestInput;
}): Promise<LogoutResponse> {
  const sessionTokenHash = hashSessionToken(input.sessionToken);
  const session = await findSessionByTokenHash(sessionTokenHash);

  if (!session) {
    return { success: true };
  }

  const verified = verifySessionToken(
    input.sessionToken,
    session.sessionTokenHash
  );

  if (!verified || !isSessionActive(session)) {
    return { success: true };
  }

  await revokeSessionById(session.id, new Date().toISOString());

  return { success: true };
}
