import { invalid, valid } from "@/src/lib/validation/validation.types";
import type { RngProvider, RngProviderType } from "./rng.types";
import {
  validateBullseyeInWinningNumbers,
  validateKenoWinningNumbers,
} from "./rng.helpers";

export function validateRngProviderForm(form: {
  name: string;
  providerType: string;
  status: string;
  endpointUrl?: string | null;
}) {
  if (!form.name.trim()) {
    return invalid("Provider name is required.");
  }

  if (!form.providerType) {
    return invalid("Provider type is required.");
  }

  if (!form.status) {
    return invalid("Provider status is required.");
  }

  if (
    form.providerType === "external_rng_service" ||
    form.providerType === "third_party"
  ) {
    if (!String(form.endpointUrl || "").trim()) {
      return invalid("External RNG service providers require an endpoint URL.");
    }
  }

  return valid();
}

export function validateRngProviderConfiguration(form: {
  providerType: RngProviderType;
  endpointUrl?: string | null;
  certificationReference?: string | null;
}) {
  if (form.providerType === "third_party" && !form.endpointUrl?.trim()) {
    return invalid("External RNG service providers require an endpoint URL.");
  }

  if (
    form.providerType === "official_feed" &&
    !form.endpointUrl?.trim() &&
    !form.certificationReference?.trim()
  ) {
    return invalid(
      "Official results feed providers require an endpoint URL or feed reference."
    );
  }

  return valid();
}

export function validateRngRequestForm(form: {
  providerId: string;
  gameId: string;
  drawingId: string;
  idempotencyKey: string;
}) {
  if (
    !form.providerId ||
    !form.gameId ||
    !form.drawingId ||
    !form.idempotencyKey
  ) {
    return invalid(
      "RNG request requires provider, game, drawing, and idempotency key."
    );
  }

  return valid();
}

export function validateRngResultForm(form: {
  winningNumbers: number[];
  bullseyeNumber?: number | null;
  expectedDrawCount?: number | null;
  numberPoolMin?: number;
  numberPoolMax?: number;
}) {
  if (
    !validateKenoWinningNumbers({
      winningNumbers: form.winningNumbers,
      expectedDrawCount: form.expectedDrawCount,
      numberPoolMin: form.numberPoolMin,
      numberPoolMax: form.numberPoolMax,
    })
  ) {
    return invalid("RNG result requires valid winning numbers.");
  }

  if (
    !validateBullseyeInWinningNumbers({
      winningNumbers: form.winningNumbers,
      bullseyeNumber: form.bullseyeNumber,
    })
  ) {
    return invalid("Bullseye number must be one of the winning numbers.");
  }

  return valid();
}

export function validateRngProviderExists(provider?: RngProvider) {
  if (!provider) {
    return invalid("RNG provider not found.");
  }

  return valid();
}
