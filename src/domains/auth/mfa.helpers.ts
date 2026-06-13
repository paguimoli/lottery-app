import { MFA_STATUSES } from "./auth.constants";
import type { MfaRecoveryCode, MfaStatus, PlatformUser } from "./auth.types";

export function isMfaStatus(value: string): value is MfaStatus {
  return Object.values(MFA_STATUSES).includes(value as MfaStatus);
}

export function isMfaEnabled(user?: Pick<PlatformUser, "mfaStatus"> | null) {
  return user?.mfaStatus === MFA_STATUSES.ENABLED;
}

export function isMfaRequired(user?: Pick<PlatformUser, "mfaStatus"> | null) {
  return (
    user?.mfaStatus === MFA_STATUSES.REQUIRED ||
    user?.mfaStatus === MFA_STATUSES.PENDING_SETUP
  );
}

export function getUnusedMfaRecoveryCodes(codes: MfaRecoveryCode[]) {
  return codes.filter((code) => !code.usedAt);
}
