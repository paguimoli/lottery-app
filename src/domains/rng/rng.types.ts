export type ResultSourceMode =
  | "internal_prng"
  | "external_rng_service"
  | "official_results_feed"
  | "manual_result_entry";

export type RngProviderType =
  | "internal"
  | "third_party"
  | "official_feed"
  | "manual";

export type RngProviderStatus = "active" | "inactive" | "suspended";

export type RngProvider = {
  id: string;
  name: string;
  providerType: RngProviderType;
  status: RngProviderStatus;
  endpointUrl?: string | null;
  apiKeyReference?: string | null;
  certificationReference?: string | null;
  version?: string | null;
  notes?: string;
  createdAt: string;
};

export type RngRequestStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

export type RngRequest = {
  id: string;
  providerId: string;
  gameId: string;
  drawingId: string;
  requestStatus: RngRequestStatus;
  requestedAt: string;
  completedAt?: string | null;
  idempotencyKey: string;
  rawRequest?: unknown;
  rawResponse?: unknown;
  errorMessage?: string | null;
};

export type RngResult = {
  id: string;
  providerId: string;
  requestId: string;
  gameId: string;
  drawingId: string;
  winningNumbers: number[];
  bullseyeNumber?: number | null;
  resultHash?: string | null;
  recordHash?: string | null;
  previousHash?: string | null;
  hashVersion?: string | null;
  createdAt: string;
};
