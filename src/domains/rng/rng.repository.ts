import type { RngProvider, RngRequest, RngResult } from "./rng.types";

export function saveRngProvider(
  providers: RngProvider[],
  provider: RngProvider
) {
  return [...providers, provider];
}

export function updateRngProvider(
  providers: RngProvider[],
  provider: RngProvider
) {
  return providers.map((createdProvider) =>
    createdProvider.id === provider.id ? provider : createdProvider
  );
}

export function deleteRngProvider(providers: RngProvider[], providerId: string) {
  return providers.filter((provider) => provider.id !== providerId);
}

export function findRngProviderById(
  providers: RngProvider[],
  providerId: string
) {
  return providers.find((provider) => provider.id === providerId);
}

export function listActiveRngProviders(providers: RngProvider[]) {
  return providers.filter((provider) => provider.status === "active");
}

export function saveRngRequest(requests: RngRequest[], request: RngRequest) {
  return [...requests, request];
}

export function updateRngRequest(requests: RngRequest[], request: RngRequest) {
  return requests.map((createdRequest) =>
    createdRequest.id === request.id ? request : createdRequest
  );
}

export function findRngRequestById(requests: RngRequest[], requestId: string) {
  return requests.find((request) => request.id === requestId);
}

export function saveRngResult(results: RngResult[], result: RngResult) {
  return [...results, result];
}

export function findRngResultByDrawingId(
  results: RngResult[],
  drawingId: string
) {
  return results.find((result) => result.drawingId === drawingId);
}
