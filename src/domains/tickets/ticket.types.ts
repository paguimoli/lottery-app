export type TicketStatus =
  | "pending"
  | "accepted"
  | "settled"
  | "void"
  | "cancelled"
  | "resettled";

export type TicketLineStatus =
  | "pending"
  | "won"
  | "lost"
  | "push"
  | "void"
  | "cancelled"
  | "resettled";

export type TicketFundingType = "cash" | "credit" | "freeplay";

export type Ticket = {
  id: string;
  ticketNumber: string;
  accountId: string;
  marketId?: string | null;
  gameId: string;
  drawingId: string;
  totalStake: number;
  potentialPayout: number;
  fundingType: TicketFundingType;
  status: TicketStatus;
  createdAt: string;
  acceptedAt?: string | null;
  settledAt?: string | null;
  reservationId?: string | null;
  ledgerTransactionIds: string[];
  notes?: string;
  recordHash?: string | null;
  previousHash?: string | null;
  hashVersion?: string | null;
};

export type TicketLine = {
  id: string;
  ticketId: string;
  wagerTypeId: string;
  wagerOptionId?: string | null;
  selectedNumbers?: number[];
  stake: number;
  potentialPayout: number;
  status: TicketLineStatus;
  resultAmount?: number | null;
  recordHash?: string | null;
  previousHash?: string | null;
  hashVersion?: string | null;
  createdAt: string;
};
