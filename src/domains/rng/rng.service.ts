import {
  generateRngIdempotencyKey,
  generateRngProviderId,
  generateRngRequestId,
  generateRngResultId,
} from "./rng.helpers";
import type {
  RngProvider,
  RngProviderStatus,
  RngProviderType,
  RngRequest,
  RngResult,
} from "./rng.types";

export function createRngProviderPayload(form: {
  name: string;
  providerType: RngProviderType;
  status: RngProviderStatus;
  endpointUrl?: string | null;
  apiKeyReference?: string | null;
  certificationReference?: string | null;
  version?: string | null;
  notes?: string;
}) {
  return {
    id: generateRngProviderId(),
    name: form.name.trim(),
    providerType: form.providerType,
    status: form.status,
    endpointUrl: form.endpointUrl?.trim() || null,
    apiKeyReference: form.apiKeyReference?.trim() || null,
    certificationReference: form.certificationReference?.trim() || null,
    version: form.version?.trim() || null,
    notes: form.notes?.trim() || "",
    createdAt: new Date().toISOString(),
  } satisfies RngProvider;
}

export function updateRngProviderPayload({
  existingProvider,
  form,
}: {
  existingProvider: RngProvider;
  form: Omit<RngProvider, "id" | "createdAt">;
}) {
  return {
    ...existingProvider,
    name: form.name.trim(),
    providerType: form.providerType,
    status: form.status,
    endpointUrl: form.endpointUrl?.trim() || null,
    apiKeyReference: form.apiKeyReference?.trim() || null,
    certificationReference: form.certificationReference?.trim() || null,
    version: form.version?.trim() || null,
    notes: form.notes?.trim() || "",
  } satisfies RngProvider;
}

export function createRngRequestPayload(form: {
  providerId: string;
  gameId: string;
  drawingId: string;
  idempotencyKey?: string;
  rawRequest?: unknown;
}) {
  return {
    id: generateRngRequestId(),
    providerId: form.providerId,
    gameId: form.gameId,
    drawingId: form.drawingId,
    requestStatus: "pending",
    requestedAt: new Date().toISOString(),
    completedAt: null,
    idempotencyKey:
      form.idempotencyKey ||
      generateRngIdempotencyKey({
        providerId: form.providerId,
        gameId: form.gameId,
        drawingId: form.drawingId,
      }),
    rawRequest: form.rawRequest,
    rawResponse: undefined,
    errorMessage: null,
  } satisfies RngRequest;
}

export function completeRngRequestPayload({
  request,
  rawResponse,
}: {
  request: RngRequest;
  rawResponse?: unknown;
}) {
  return {
    ...request,
    requestStatus: "completed",
    completedAt: new Date().toISOString(),
    rawResponse,
    errorMessage: null,
  } satisfies RngRequest;
}

export function createRngResultPayload(form: {
  providerId: string;
  requestId: string;
  gameId: string;
  drawingId: string;
  winningNumbers: number[];
  bullseyeNumber?: number | null;
  resultHash?: string | null;
}) {
  return {
    id: generateRngResultId(),
    providerId: form.providerId,
    requestId: form.requestId,
    gameId: form.gameId,
    drawingId: form.drawingId,
    winningNumbers: form.winningNumbers,
    bullseyeNumber: form.bullseyeNumber ?? null,
    resultHash: form.resultHash || null,
    createdAt: new Date().toISOString(),
  } satisfies RngResult;
}
