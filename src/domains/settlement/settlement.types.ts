export type SettlementRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "partially_completed"
  | "recovering"
  | "reversed";

export type SettlementRecordStatus =
  | "pending"
  | "settled"
  | "reversed"
  | "failed"
  | "void";

export type SettlementOutcome = "win" | "loss" | "push" | "void" | "failed";

export type SettlementRun = {
  id: string;
  drawingId: string;
  gameId: string;
  status: SettlementRunStatus;
  expectedTicketCount: number;
  expectedLineCount: number;
  startedAt?: string | null;
  completedAt?: string | null;
  executionId?: string | null;
  processedTicketCount: number;
  processedLineCount: number;
  winCount: number;
  lossCount: number;
  pushCount: number;
  failedCount: number;
  totalStake: number;
  totalPayout: number;
  totalNet: number;
  durationMs: number;
  ticketsPerSecond: number;
  linesPerSecond: number;
  drawToSettlementMs?: number | null;
  peakConcurrentSettlements: number;
  notes?: string;
  createdAt: string;
};

export type SettlementRecord = {
  id: string;
  settlementRunId: string;
  ticketId: string;
  ticketLineId: string;
  accountId: string;
  gameId: string;
  drawingId: string;
  wagerTypeId: string;
  wagerOptionId?: string | null;
  stake: number;
  payout: number;
  netAmount: number;
  outcome: SettlementOutcome;
  status: SettlementRecordStatus;
  version: number;
  previousSettlementRecordId?: string | null;
  reversalOfSettlementRecordId?: string | null;
  ledgerTransactionIds: string[];
  createdAt: string;
};
