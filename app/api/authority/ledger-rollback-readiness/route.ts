import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { validateRollbackReadiness } from "@/src/domains/authority-control/authority-control.service";

export const runtime = "nodejs";

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json({ success: false, error: error.message }, { status: error.status });
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const rollbackReadiness = await validateRollbackReadiness();

    return NextResponse.json({
      success: true,
      rollbackReadiness: rollbackReadiness.ledger,
      evaluatedAt: rollbackReadiness.evaluatedAt,
    });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load ledger rollback readiness." },
      { status: 500 }
    );
  }
}
