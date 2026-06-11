import {
  controllerFailure,
  controllerSuccess,
} from "@/src/lib/controller/controller.types";
import {
  deleteRngProvider,
  findRngProviderById,
  findRngRequestById,
  saveRngProvider,
  saveRngRequest,
  saveRngResult,
  updateRngProvider,
  updateRngRequest,
} from "./rng.repository";
import {
  completeRngRequestPayload,
  createRngProviderPayload,
  createRngRequestPayload,
  createRngResultPayload,
  updateRngProviderPayload,
} from "./rng.service";
import type { RngProvider, RngRequest, RngResult } from "./rng.types";
import {
  validateRngProviderConfiguration,
  validateRngProviderExists,
  validateRngProviderForm,
  validateRngRequestForm,
  validateRngResultForm,
} from "./rng.validation";

export function createRngProviderController({
  providers,
  form,
}: {
  providers: RngProvider[];
  form: Parameters<typeof createRngProviderPayload>[0];
}) {
  const formValidation = validateRngProviderForm(form);

  if (!formValidation.valid) {
    return controllerFailure(formValidation.errors);
  }

  const configValidation = validateRngProviderConfiguration(form);

  if (!configValidation.valid) {
    return controllerFailure(configValidation.errors);
  }

  const provider = createRngProviderPayload(form);

  return controllerSuccess({
    provider,
    providers: saveRngProvider(providers, provider),
  });
}

export function updateRngProviderController({
  providers,
  providerId,
  form,
}: {
  providers: RngProvider[];
  providerId: string;
  form: Omit<RngProvider, "id" | "createdAt">;
}) {
  const existingProvider = findRngProviderById(providers, providerId);
  const existsValidation = validateRngProviderExists(existingProvider);

  if (!existsValidation.valid || !existingProvider) {
    return controllerFailure(existsValidation.errors);
  }

  const formValidation = validateRngProviderForm(form);

  if (!formValidation.valid) {
    return controllerFailure(formValidation.errors);
  }

  const configValidation = validateRngProviderConfiguration(form);

  if (!configValidation.valid) {
    return controllerFailure(configValidation.errors);
  }

  const provider = updateRngProviderPayload({ existingProvider, form });

  return controllerSuccess({
    provider,
    providers: updateRngProvider(providers, provider),
  });
}

export function deleteRngProviderController({
  providers,
  providerId,
}: {
  providers: RngProvider[];
  providerId: string;
}) {
  return controllerSuccess({
    providers: deleteRngProvider(providers, providerId),
  });
}

export function createRngRequestController({
  requests,
  form,
}: {
  requests: RngRequest[];
  form: Parameters<typeof createRngRequestPayload>[0];
}) {
  const request = createRngRequestPayload(form);
  const validation = validateRngRequestForm(request);

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  return controllerSuccess({
    request,
    requests: saveRngRequest(requests, request),
  });
}

export function completeRngRequestController({
  requests,
  requestId,
  rawResponse,
}: {
  requests: RngRequest[];
  requestId: string;
  rawResponse?: unknown;
}) {
  const request = findRngRequestById(requests, requestId);

  if (!request) {
    return controllerFailure("RNG request not found.");
  }

  const completedRequest = completeRngRequestPayload({ request, rawResponse });

  return controllerSuccess({
    request: completedRequest,
    requests: updateRngRequest(requests, completedRequest),
  });
}

export function createRngResultController({
  results,
  form,
}: {
  results: RngResult[];
  form: Parameters<typeof createRngResultPayload>[0] & {
    expectedDrawCount?: number | null;
    numberPoolMin?: number;
    numberPoolMax?: number;
  };
}) {
  const validation = validateRngResultForm(form);

  if (!validation.valid) {
    return controllerFailure(validation.errors);
  }

  const result = createRngResultPayload(form);

  return controllerSuccess({
    result,
    results: saveRngResult(results, result),
  });
}
