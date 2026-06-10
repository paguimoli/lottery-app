import type { AccountType } from "./account.types";

export function getAccountTypeLabel(accountType: AccountType) {
  if (accountType === "super_master") return "House / Super Master";
  if (accountType === "master_agent") return "Master Agent";
  if (accountType === "agent") return "Agent";
  return "Player";
}
