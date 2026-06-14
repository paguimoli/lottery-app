import { supabaseServerAdmin } from "@/src/lib/supabase/server-admin-client";
import { isIdentityClass, isUserStatus } from "./auth.helpers";
import type { AuthUserRecord } from "./auth.types";
import type { SessionRecord, SessionTokenHash } from "./session.types";

type PlatformUserRow = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  identity_class: string;
  status: string;
  password_hash?: string | null;
  failed_login_attempts?: number | null;
  locked_until?: string | null;
  last_login_at?: string | null;
};

type UserSessionRow = {
  id: string;
  user_id: string;
  session_token_hash: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at?: string | null;
};

export type CreateSessionRecordInput = {
  userId: string;
  sessionTokenHash: SessionTokenHash;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export class AuthRepositoryError extends Error {
  constructor(message = "Authentication persistence operation failed.") {
    super(message);
    this.name = "AuthRepositoryError";
  }
}

function mapPlatformUserRow(row: PlatformUserRow | null): AuthUserRecord | null {
  if (!row) {
    return null;
  }

  if (!isIdentityClass(row.identity_class) || !isUserStatus(row.status)) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    identityClass: row.identity_class,
    status: row.status,
    passwordHash: row.password_hash ?? null,
    failedLoginAttempts: row.failed_login_attempts ?? 0,
    lockedUntil: row.locked_until ?? null,
    lastLoginAt: row.last_login_at ?? null,
  };
}

function mapUserSessionRow(row: UserSessionRow | null): SessionRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    sessionTokenHash: row.session_token_hash,
    ipAddress: row.ip_address ?? null,
    userAgent: row.user_agent ?? null,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at ?? null,
  };
}

export async function findUserByUsername(
  username: string
): Promise<AuthUserRecord | null> {
  const { data, error } = await supabaseServerAdmin
    .from("platform_users")
    .select(
      "id, username, email, display_name, identity_class, status, password_hash, failed_login_attempts, locked_until, last_login_at"
    )
    .eq("username", username)
    .maybeSingle();

  if (error) {
    throw new AuthRepositoryError();
  }

  return mapPlatformUserRow(data as PlatformUserRow | null);
}

export async function saveUserSession(
  input: CreateSessionRecordInput
): Promise<SessionRecord> {
  const { data, error } = await supabaseServerAdmin
    .from("user_sessions")
    .insert({
      user_id: input.userId,
      session_token_hash: input.sessionTokenHash,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      created_at: input.createdAt,
      last_seen_at: input.lastSeenAt,
      expires_at: input.expiresAt,
      revoked_at: null,
    })
    .select(
      "id, user_id, session_token_hash, ip_address, user_agent, created_at, last_seen_at, expires_at, revoked_at"
    )
    .single();

  if (error) {
    throw new AuthRepositoryError();
  }

  const session = mapUserSessionRow(data as UserSessionRow | null);

  if (!session) {
    throw new AuthRepositoryError();
  }

  return session;
}

export async function findSessionByTokenHash(
  sessionTokenHash: SessionTokenHash
): Promise<SessionRecord | null> {
  const { data, error } = await supabaseServerAdmin
    .from("user_sessions")
    .select(
      "id, user_id, session_token_hash, ip_address, user_agent, created_at, last_seen_at, expires_at, revoked_at"
    )
    .eq("session_token_hash", sessionTokenHash)
    .maybeSingle();

  if (error) {
    throw new AuthRepositoryError();
  }

  return mapUserSessionRow(data as UserSessionRow | null);
}

export async function revokeActiveSessionsForUser(
  userId: string,
  revokedAt: string
): Promise<void> {
  const { error } = await supabaseServerAdmin
    .from("user_sessions")
    .update({ revoked_at: revokedAt })
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", revokedAt);

  if (error) {
    throw new AuthRepositoryError();
  }
}

export async function revokeSessionById(
  sessionId: string,
  revokedAt: string
): Promise<void> {
  const { error } = await supabaseServerAdmin
    .from("user_sessions")
    .update({ revoked_at: revokedAt })
    .eq("id", sessionId)
    .is("revoked_at", null);

  if (error) {
    throw new AuthRepositoryError();
  }
}
