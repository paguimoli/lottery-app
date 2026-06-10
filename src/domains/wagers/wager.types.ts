export const KENO_METRIC_KEYS = [
  "drawSum",
  "oddCount",
  "evenCount",
  "lowCount",
  "highCount",
  "firstHalfCount",
  "secondHalfCount",
  "dragonDigit",
  "tigerDigit",
  "dragonTigerResult",
  "upDownResult",
  "woodCount",
  "fireCount",
  "earthCount",
  "metalCount",
  "waterCount",
];

export const COMPARISON_OPERATORS = [">", "<", ">=", "<=", "==", "!="] as const;

export type SettlementMethod =
  | "hit_count"
  | "hit_count_bullseye"
  | "metric_comparison"
  | "metric_threshold"
  | "element_count"
  | "dragon_tiger"
  | "selection_match";

export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

export type PayTableRow = {
  id: string;
  spotCount: number;
  hitCount: number;
  bullseyeRequired: boolean;
  payout: number;
};

export type PayTable = {
  id: string;
  gameId: string;
  name: string;
  active: boolean;
  effectiveDate: string;
  rows: PayTableRow[];
};

export type KenoDrawMetrics = {
  id: string;
  drawingId: string;
  gameId: string;
  drawSum: number;
  oddCount: number;
  evenCount: number;
  lowCount: number;
  highCount: number;
  firstHalfCount: number;
  secondHalfCount: number;
  minDrawnNumber: number;
  maxDrawnNumber: number;
  dragonDigit: number;
  tigerDigit: number;
  dragonTigerResult: "dragon" | "tiger" | "tie";
  upDownResult: "up" | "down" | "tie";
  bullseyeNumber?: number | null;
  woodCount: number;
  fireCount: number;
  earthCount: number;
  metalCount: number;
  waterCount: number;
  createdAt: string;
};

export type WagerType = {
  id: string;
  gameId: string;
  name: string;
  code: string;
  active: boolean;
  settlementMethod: SettlementMethod;
  metricKey?: string;
  comparisonOperator?: ComparisonOperator;
  thresholdValue?: number | null;
  payTableId?: string | null;
  createdAt: string;
};

export type WagerOption = {
  id: string;
  wagerTypeId: string;
  name: string;
  code: string;
  active: boolean;
};
