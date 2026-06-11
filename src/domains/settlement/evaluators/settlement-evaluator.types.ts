import type { TicketLine } from "../../tickets/ticket.types";
import type {
  KenoDrawMetrics,
  PayTableRow,
  WagerOption,
  WagerType,
} from "../../wagers/wager.types";

export type SettlementEvaluationOutcome =
  | "win"
  | "loss"
  | "push"
  | "void"
  | "failed";

export type SettlementEvaluationResult = {
  outcome: SettlementEvaluationOutcome;
  payout: number;
  netAmount: number;
  reason: string;
  metadata?: Record<string, unknown>;
};

export type SettlementEvaluationInput = {
  ticketLine: TicketLine;
  wagerType: WagerType;
  wagerOption?: WagerOption | null;
  winningNumbers: number[];
  bullseyeNumber?: number | null;
  drawMetrics?: KenoDrawMetrics | null;
  payTableRows?: PayTableRow[];
};

export function winResult({
  stake,
  payout,
  reason,
  metadata,
}: {
  stake: number;
  payout: number;
  reason: string;
  metadata?: Record<string, unknown>;
}): SettlementEvaluationResult {
  return {
    outcome: "win",
    payout,
    netAmount: payout - stake,
    reason,
    metadata,
  };
}

export function lossResult({
  stake,
  reason,
  metadata,
}: {
  stake: number;
  reason: string;
  metadata?: Record<string, unknown>;
}): SettlementEvaluationResult {
  return {
    outcome: "loss",
    payout: 0,
    netAmount: -stake,
    reason,
    metadata,
  };
}

export function pushResult({
  reason,
  metadata,
}: {
  reason: string;
  metadata?: Record<string, unknown>;
}): SettlementEvaluationResult {
  return {
    outcome: "push",
    payout: 0,
    netAmount: 0,
    reason,
    metadata,
  };
}

export function failedResult({
  reason,
  metadata,
}: {
  reason: string;
  metadata?: Record<string, unknown>;
}): SettlementEvaluationResult {
  return {
    outcome: "failed",
    payout: 0,
    netAmount: 0,
    reason,
    metadata,
  };
}

export function getStake(input: SettlementEvaluationInput) {
  return Number(input.ticketLine.stake || 0);
}

export function getTemporaryPayout(input: SettlementEvaluationInput) {
  // TODO: replace fallback with final non-hit-count paytable row shape.
  const payTablePayout = input.payTableRows?.[0]?.payout;

  return Number(payTablePayout ?? input.ticketLine.potentialPayout ?? 0);
}
