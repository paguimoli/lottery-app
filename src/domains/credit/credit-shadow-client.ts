import { logger } from "@/src/lib/observability/logger";
import type {
  ApplyCreditSettlementInput,
  CreditReservation,
  CreditSettlementApplicationResult,
  ReleaseCreditExposureInput,
  ReserveCreditExposureInput,
} from "./credit-reservation.types";

type CreditShadowOperation = "reserve" | "release" | "settlement";
type CreditShadowComparisonStatus = "MATCH" | "MISMATCH" | "NOT_COMPARED";

type CreditShadowResponse = {
  success: boolean;
  shadowCreditRunId?: string | null;
  comparisonStatus: CreditShadowComparisonStatus;
  mismatches: Array<{
    field: string;
    expected: string;
    actual: string;
    mismatchType: string;
    severity: string;
  }>;
  correlationId: string;
};

function isShadowModeEnabled() {
  return process.env.CREDIT_SHADOW_MODE_ENABLED === "true";
}

function getCreditServiceUrl() {
  return (
    process.env.CREDIT_SERVICE_URL?.replace(/\/$/, "") ||
    "http://credit-wallet-service:8080"
  );
}

async function callCreditShadow({
  operation,
  payload,
  correlationId,
}: {
  operation: CreditShadowOperation;
  payload: Record<string, unknown>;
  correlationId?: string | null;
}) {
  const response = await fetch(
    `${getCreditServiceUrl()}/v1/credit/shadow/${operation}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(correlationId ? { "x-correlation-id": correlationId } : {}),
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(`Credit shadow endpoint returned ${response.status}.`);
  }

  return response.json() as Promise<CreditShadowResponse>;
}

function logShadowResult({
  operation,
  result,
  aggregate,
}: {
  operation: CreditShadowOperation;
  result: CreditShadowResponse;
  aggregate: Record<string, unknown>;
}) {
  if (result.comparisonStatus === "MISMATCH") {
    logger.warn({
      message: "Credit shadow comparison mismatch.",
      correlationId: result.correlationId,
      metadata: {
        operation,
        shadowCreditRunId: result.shadowCreditRunId ?? null,
        mismatches: result.mismatches,
        ...aggregate,
      },
    });
    return;
  }

  logger.info({
    message: "Credit shadow comparison completed.",
    correlationId: result.correlationId,
    metadata: {
      operation,
      shadowCreditRunId: result.shadowCreditRunId ?? null,
      comparisonStatus: result.comparisonStatus,
      ...aggregate,
    },
  });
}

export async function runCreditReservationShadowComparison({
  input,
  reservation,
}: {
  input: ReserveCreditExposureInput;
  reservation: CreditReservation;
}): Promise<void> {
  if (!isShadowModeEnabled()) return;

  try {
    const result = await callCreditShadow({
      operation: "reserve",
      correlationId: input.correlationId,
      payload: {
        correlationId: input.correlationId,
        accountId: reservation.playerId,
        ticketId: reservation.ticketId,
        reservationId: reservation.id,
        amountMinor: reservation.reservedAmount,
        currency: reservation.currency,
        metadata: input.metadata ?? {},
        expectedMonolithResult: {
          amountMinor: reservation.reservedAmount,
          reservedAmount: reservation.reservedAmount,
          currency: reservation.currency,
        },
      },
    });
    logShadowResult({
      operation: "reserve",
      result,
      aggregate: {
        reservationId: reservation.id,
        ticketId: reservation.ticketId,
      },
    });
  } catch (error) {
    logger.warn({
      message: "Credit reservation shadow comparison failed.",
      correlationId: input.correlationId,
      metadata: {
        reservationId: reservation.id,
        ticketId: reservation.ticketId,
        error:
          error instanceof Error ? error.message : "Unknown credit shadow error.",
      },
    });
  }
}

export async function runCreditReleaseShadowComparison({
  input,
  reservation,
}: {
  input: ReleaseCreditExposureInput;
  reservation: CreditReservation;
}): Promise<void> {
  if (!isShadowModeEnabled()) return;

  try {
    const releasedAmountBefore = reservation.releasedAmount - input.releaseAmount;
    const remainingExposureBefore =
      reservation.remainingExposure + input.releaseAmount;
    const result = await callCreditShadow({
      operation: "release",
      correlationId: input.correlationId,
      payload: {
        correlationId: input.correlationId,
        accountId: reservation.playerId,
        ticketId: reservation.ticketId,
        reservationId: reservation.id,
        amountMinor: input.releaseAmount,
        currency: reservation.currency,
        remainingExposureBefore,
        releasedAmountBefore,
        metadata: input.metadata ?? {},
        expectedMonolithResult: {
          amountMinor: input.releaseAmount,
          releasedAmount: reservation.releasedAmount,
          remainingExposure: reservation.remainingExposure,
          currency: reservation.currency,
        },
      },
    });
    logShadowResult({
      operation: "release",
      result,
      aggregate: {
        reservationId: reservation.id,
        ticketId: reservation.ticketId,
      },
    });
  } catch (error) {
    logger.warn({
      message: "Credit release shadow comparison failed.",
      correlationId: input.correlationId,
      metadata: {
        reservationId: reservation.id,
        ticketId: reservation.ticketId,
        error:
          error instanceof Error ? error.message : "Unknown credit shadow error.",
      },
    });
  }
}

export async function runCreditSettlementShadowComparison({
  input,
  application,
}: {
  input: ApplyCreditSettlementInput;
  application: CreditSettlementApplicationResult;
}): Promise<void> {
  if (!isShadowModeEnabled()) return;

  try {
    const releasedAmountBefore =
      application.releasedAmount - application.releaseAmount;
    const remainingExposureBefore =
      application.remainingExposure + application.releaseAmount;
    const result = await callCreditShadow({
      operation: "settlement",
      correlationId: input.correlationId,
      payload: {
        correlationId: input.correlationId,
        accountId: application.playerId,
        ticketId: application.ticketId,
        reservationId: application.reservationId,
        amountMinor: application.releaseAmount,
        currency: application.currency,
        remainingExposureBefore,
        releasedAmountBefore,
        balanceBefore: application.balanceBefore,
        balanceImpactMinor: application.balanceImpact,
        metadata: input.metadata ?? {},
        expectedMonolithResult: {
          amountMinor: application.releaseAmount,
          releasedAmount: application.releasedAmount,
          remainingExposure: application.remainingExposure,
          balanceImpact: application.balanceImpact,
          currency: application.currency,
        },
      },
    });
    logShadowResult({
      operation: "settlement",
      result,
      aggregate: {
        applicationId: application.applicationId,
        reservationId: application.reservationId,
        ticketId: application.ticketId,
        settlementId: application.settlementId,
      },
    });
  } catch (error) {
    logger.warn({
      message: "Credit settlement shadow comparison failed.",
      correlationId: input.correlationId,
      metadata: {
        reservationId: application.reservationId,
        ticketId: application.ticketId,
        settlementId: application.settlementId,
        error:
          error instanceof Error ? error.message : "Unknown credit shadow error.",
      },
    });
  }
}
