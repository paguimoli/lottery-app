import { IDENTITY_CLASSES, USER_STATUSES } from "./auth.constants";
import type {
  IdentityClass,
  PlatformUser,
  UserGroup,
  UserGroupMembership,
  UserStatus,
} from "./auth.types";

export function isIdentityClass(value: string): value is IdentityClass {
  return Object.values(IDENTITY_CLASSES).includes(value as IdentityClass);
}

export function isUserStatus(value: string): value is UserStatus {
  return Object.values(USER_STATUSES).includes(value as UserStatus);
}

export function isActiveUser(user?: Pick<PlatformUser, "status"> | null) {
  return user?.status === USER_STATUSES.ACTIVE;
}

export function isPlatformOperator(
  user?: Pick<PlatformUser, "identityClass"> | null
) {
  return user?.identityClass === IDENTITY_CLASSES.PLATFORM_OPERATOR;
}

export function isHierarchyParticipant(
  user?: Pick<PlatformUser, "identityClass"> | null
) {
  return user?.identityClass === IDENTITY_CLASSES.HIERARCHY_PARTICIPANT;
}

export function getUserGroupIdsForUser(
  memberships: UserGroupMembership[],
  userId: string
) {
  return memberships
    .filter((membership) => membership.userId === userId && membership.active)
    .map((membership) => membership.groupId);
}

export function getUserGroupsForUser({
  groups,
  memberships,
  userId,
}: {
  groups: UserGroup[];
  memberships: UserGroupMembership[];
  userId: string;
}) {
  const groupIds = new Set(getUserGroupIdsForUser(memberships, userId));

  return groups.filter((group) => group.active && groupIds.has(group.id));
}
