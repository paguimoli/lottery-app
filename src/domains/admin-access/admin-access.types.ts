export type AdminPermission =
  | "games.view"
  | "games.manage"
  | "draws.view"
  | "draws.manage"
  | "results.post"
  | "results.correct"
  | "draws.void"
  | "paytables.view"
  | "paytables.manage"
  | "wagers.view"
  | "wagers.manage"
  | "players.view"
  | "players.manage"
  | "wallets.view"
  | "wallets.adjust"
  | "tickets.view"
  | "tickets.manage"
  | "settlement.view"
  | "settlement.run"
  | "settlement.resettle"
  | "reports.view"
  | "reports.export"
  | "admin_users.view"
  | "admin_users.manage"
  | "audit.view"
  | "risk.view"
  | "risk.manage"
  | "rng.view"
  | "rng.manage"
  | "pam.view"
  | "pam.manage";

export type AdminRole = {
  id: string;
  name: string;
  description: string;
  permissions: AdminPermission[];
  active: boolean;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  roleIds: string[];
  status: "active" | "suspended" | "inactive";
  createdAt: string;
};

export const ADMIN_PERMISSION_GROUPS: Array<{
  name: string;
  permissions: AdminPermission[];
}> = [
  {
    name: "Games & Draws",
    permissions: ["games.view", "games.manage", "draws.view", "draws.manage"],
  },
  {
    name: "Results",
    permissions: ["results.post", "results.correct", "draws.void"],
  },
  {
    name: "Pay Tables & Wagers",
    permissions: [
      "paytables.view",
      "paytables.manage",
      "wagers.view",
      "wagers.manage",
    ],
  },
  {
    name: "Players & Wallets",
    permissions: [
      "players.view",
      "players.manage",
      "wallets.view",
      "wallets.adjust",
    ],
  },
  {
    name: "Tickets & Settlement",
    permissions: [
      "tickets.view",
      "tickets.manage",
      "settlement.view",
      "settlement.run",
      "settlement.resettle",
    ],
  },
  {
    name: "Reports & Audit",
    permissions: ["reports.view", "reports.export", "audit.view"],
  },
  {
    name: "Risk",
    permissions: ["risk.view", "risk.manage"],
  },
  {
    name: "System Integrations",
    permissions: ["rng.view", "rng.manage", "pam.view", "pam.manage"],
  },
  {
    name: "Admin Management",
    permissions: ["admin_users.view", "admin_users.manage"],
  },
];

export const ALL_ADMIN_PERMISSIONS = ADMIN_PERMISSION_GROUPS.flatMap(
  (group) => group.permissions
);
