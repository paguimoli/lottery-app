import { logger } from "@/src/lib/observability/logger";
import {
  applyCreditSettlement as applyCreditSettlementRecord,
  getPlayerCreditSummary as getPlayerCreditSummaryRecord,
  releaseCreditExposure as releaseCreditExposureRecord,
  reserveCreditExposure as reserveCreditExposureRecord,
} from "./credit-reservation.repository";
import type {
  ApplyCreditSettlementInput,
  CreditReservation,
  CreditSettlementApplicationResult,
  CreditSummary,
  ReleaseCreditExposureInput,
  ReserveCreditExposureInput,
} from "./credit-reservation.types";
import {
  validateApplyCreditSettlementInput,
  validateReleaseCreditExposureInput,
  validateReserveCreditExposureInput,
} from "./credit-reservation.validation";

export class CreditReservationValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join(" "));
    this.name = "CreditReservationValidationError";
    this.errors = errors;
  }
}

export async function reserveCreditExposure(
  input: ReserveCreditExposureInput
): Promise<CreditReservation> {
  const validation = validateReserveCreditExposureInput(input);

  if (!validation.valid) {
    throw new CreditReservationValidationError(validation.errors);
  }

  logger.info({
    message: "Credit exposure reservation requested.",
    correlationId: input.correlationId,
    metadata: {
      playerId: input.playerId,
      ticketId: input.ticketId,
      amount: input.amount,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
    },
  });

  return reserveCreditExposureRecord(input);
}

export async function releaseCreditExposure(
  input: ReleaseCreditExposureInput
): Promise<CreditReservation> {
  const validation = validateReleaseCreditExposureInput(input);

  if (!validation.valid) {
    throw new CreditReservationValidationError(validation.errors);
  }

  logger.info({
    message: "Credit exposure release requested.",
    correlationId: input.correlationId,
    metadata: {
      reservationId: input.reservationId,
      ticketId: input.ticketId,
      releaseAmount: input.releaseAmount,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason ?? null,
    },
  });

  return releaseCreditExposureRecord(input);
}

export async function applyCreditSettlement(
  input: ApplyCreditSettlementInput
): Promise<CreditSettlementApplicationResult> {
  const validation = validateApplyCreditSettlementInput(input);

  if (!validation.valid) {
    throw new CreditReservationValidationError(validation.errors);
  }

  logger.info({
    message: "Credit settlement application requested.",
    correlationId: input.correlationId,
    metadata: {
      reservationId: input.reservationId,
      ticketId: input.ticketId,
      settlementId: input.settlementId,
      releaseAmount: input.releaseAmount,
      balanceImpact: input.balanceImpact,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
    },
  });

  return applyCreditSettlementRecord(input);
}

export async function getPlayerCreditSummary(
  playerId: string
): Promise<CreditSummary> {
  if (!playerId) {
    throw new CreditReservationValidationError(["Player id is required."]);
  }

  return getPlayerCreditSummaryRecord(playerId);
}
