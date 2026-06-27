import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getDatabaseConnectionSummary } from "@/src/domains/database-performance/database-performance.service";
import { logger } from "@/src/lib/observability/logger";

export const runtime = "nodejs";

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json(
    { success: false, error: error.message },
    { status: error.status }
  );
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const connections = await getDatabaseConnectionSummary();

    return NextResponse.json({ success: true, connections });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    logger.error({
      message: "Database connection report failed.",
      metadata: { error: error instanceof Error ? error.message : "Unknown error." },
    });

    return NextResponse.json(
      { success: false, error: "Unable to load database connection report." },
      { status: 500 }
    );
  }
}
