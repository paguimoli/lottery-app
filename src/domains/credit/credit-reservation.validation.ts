import type {
  ReleaseCreditExposureInput,
  ReserveCreditExposureInput,
} from "./credit-reservation.types";

function isIso4217Currency(currency: string) {
  return /^[A-Z]{3}$/.test(currency);
}

function isIntegerMinorUnitAmount(amount: number) {
  return Number.isInteger(amount);
}

export function validateReserveCreditExposureInput(
  input: ReserveCreditExposureInput
) {
  const errors: string[] = [];

  if (!input.playerId) errors.push("Player id is required.");
  if (!input.ticketId.trim()) errors.push("Ticket id is required.");
  if (!input.idempotencyKey.trim()) {
    errors.push("Idempotency key is required.");
  }
  if (!isIntegerMinorUnitAmount(input.amount) || input.amount <= 0) {
    errors.push("Reservation amount must be a positive integer minor unit value.");
  }
  if (!isIso4217Currency(input.currency)) {
    errors.push("Currency must be an ISO-4217 code.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateReleaseCreditExposureInput(
  input: ReleaseCreditExposureInput
) {
  const errors: string[] = [];

  if (!input.reservationId) errors.push("Reservation id is required.");
  if (!input.ticketId.trim()) errors.push("Ticket id is required.");
  if (!input.idempotencyKey.trim()) {
    errors.push("Idempotency key is required.");
  }
  if (!isIntegerMinorUnitAmount(input.releaseAmount) || input.releaseAmount <= 0) {
    errors.push("Release amount must be a positive integer minor unit value.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
