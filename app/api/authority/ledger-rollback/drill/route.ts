import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import {
  LedgerAuthorityValidationError,
  simulateLedgerRollbackDrill,
} from "@/src/domains/ledger-authority/ledger-authority.service";
import { logger } from "@/src/lib/observability/logger";

export const runtime = "nodejs";

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json(
    {
      success: false,
      error: error.message,
    },
    { status: error.status }
  );
}

function sanitizeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: "Unknown error." };
  }

  return {
    name: error.name,
    message: error.message,
  };
}

export async function POST(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const body = await request.json().catch(() => ({}));
    const drill = await simulateLedgerRollbackDrill({
      mode: body.mode,
      correlationId: body.correlationId,
    });

    return NextResponse.json({
      success: true,
      drill,
    });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) {
      return authErrorResponse(error);
    }

    if (error instanceof LedgerAuthorityValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: error.status }
      );
    }

    logger.error({
      message: "Ledger rollback drill failed.",
      metadata: sanitizeError(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: "Unable to run Ledger rollback drill.",
      },
      { status: 500 }
    );
  }
}
