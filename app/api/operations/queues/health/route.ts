import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getQueueHealthSummary } from "@/src/domains/operations/queue-health.service";

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

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const health = await getQueueHealthSummary();

    return NextResponse.json({
      success: true,
      health,
    });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) {
      return authErrorResponse(error);
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load queue operations health.",
      },
      { status: 500 }
    );
  }
}
