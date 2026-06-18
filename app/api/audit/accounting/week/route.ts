import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getAuditTrailByAccountingWeek } from "@/src/domains/audit/audit.service";

export const runtime = "nodejs";

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json({ success: false, error: error.message }, { status: error.status });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const weekStart = url.searchParams.get("weekStart") ?? "";
  const weekEnd = url.searchParams.get("weekEnd") ?? "";
  const currency = url.searchParams.get("currency");

  if (!weekStart || !weekEnd) {
    return NextResponse.json(
      { success: false, errors: ["weekStart and weekEnd are required."] },
      { status: 400 }
    );
  }

  try {
    await requirePermission(request, "audit.view");
    const trail = await getAuditTrailByAccountingWeek({
      weekStart,
      weekEnd,
      currency,
    });

    return NextResponse.json({ success: true, trail });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load accounting week audit trail." },
      { status: 500 }
    );
  }
}
