export type AccountType = "super_master" | "master_agent" | "agent" | "player";

export type AccountStatus = "active" | "suspended" | "inactive";

export type PlayerAccount = {
  id: string;
  accountType: AccountType;
  parentId: string | null;
  username: string;
  displayName: string;
  email?: string;
  phone?: string;
  marketId?: string | null;
  language?: string;
  currency?: string;
  status: AccountStatus;
  cashBalance: number;
  creditLimit: number;
  currentExposure: number;
  availableCredit: number;
  maxBet?: number;
  maxPayout?: number;
  notes?: string;
  createdAt: string;
};
