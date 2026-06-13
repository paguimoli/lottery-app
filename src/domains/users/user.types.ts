import type { IdentityClass, UserStatus } from "../auth/auth.types";

export type UserIdentitySummary = {
  id: string;
  username: string;
  email?: string | null;
  displayName?: string | null;
  identityClass: IdentityClass;
  status: UserStatus;
  accountId?: string | null;
};

export type UserNameParts = {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
};
