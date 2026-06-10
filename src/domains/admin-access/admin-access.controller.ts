import {
  controllerFailure,
  controllerSuccess,
} from "@/src/lib/controller/controller.types";
import { buildDefaultAdminRoles } from "./admin-access.service";
import type { AdminRole, AdminUser } from "./admin-access.types";
import {
  validateAdminRoleForm,
  validateAdminUserForm,
} from "./admin-access.validation";

export function saveAdminRoleController({
  form,
  adminRoles,
  editingAdminRoleId,
}: {
  form: {
    name: string;
    description: string;
    permissions: AdminRole["permissions"];
    active: boolean;
  };
  adminRoles: AdminRole[];
  editingAdminRoleId?: string | null;
}) {
  const validation = validateAdminRoleForm({
    form,
    adminRoles,
    editingAdminRoleId,
  });

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const existingRole = adminRoles.find((role) => role.id === editingAdminRoleId);
  const role: AdminRole = {
    id: existingRole?.id || `ROLE-${Date.now()}`,
    name: form.name.trim(),
    description: form.description.trim(),
    permissions: form.permissions,
    active: form.active,
    createdAt: existingRole?.createdAt || new Date().toISOString(),
  };

  return controllerSuccess({
    role,
    adminRoles: editingAdminRoleId
      ? adminRoles.map((createdRole) =>
          createdRole.id === editingAdminRoleId ? role : createdRole
        )
      : [...adminRoles, role],
  });
}

export function deleteAdminRoleController({
  roleId,
  adminRoles,
  adminUsers,
}: {
  roleId: string;
  adminRoles: AdminRole[];
  adminUsers: AdminUser[];
}) {
  return controllerSuccess({
    adminRoles: adminRoles.filter((role) => role.id !== roleId),
    adminUsers: adminUsers.map((user) => ({
      ...user,
      roleIds: user.roleIds.filter((userRoleId) => userRoleId !== roleId),
    })),
  });
}

export function addDefaultRolesController(adminRoles: AdminRole[]) {
  const newRoles = buildDefaultAdminRoles(adminRoles);

  if (newRoles.length === 0) {
    return controllerFailure("Default admin roles already exist.");
  }

  return controllerSuccess({
    newRoles,
    adminRoles: [...adminRoles, ...newRoles],
  });
}

export function saveAdminUserController({
  form,
  adminUsers,
  editingAdminUserId,
}: {
  form: {
    name: string;
    email: string;
    roleIds: string[];
    status: AdminUser["status"];
  };
  adminUsers: AdminUser[];
  editingAdminUserId?: string | null;
}) {
  const validation = validateAdminUserForm({
    form,
    adminUsers,
    editingAdminUserId,
  });

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const existingUser = adminUsers.find((user) => user.id === editingAdminUserId);
  const user: AdminUser = {
    id: existingUser?.id || `ADMIN-${Date.now()}`,
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    roleIds: form.roleIds,
    status: form.status,
    createdAt: existingUser?.createdAt || new Date().toISOString(),
  };

  return controllerSuccess({
    user,
    adminUsers: editingAdminUserId
      ? adminUsers.map((createdUser) =>
          createdUser.id === editingAdminUserId ? user : createdUser
        )
      : [...adminUsers, user],
  });
}

export function deleteAdminUserController({
  userId,
  adminUsers,
}: {
  userId: string;
  adminUsers: AdminUser[];
}) {
  return controllerSuccess({
    adminUsers: adminUsers.filter((user) => user.id !== userId),
  });
}
