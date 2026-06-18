import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getAuditTrailByCorrelationId } from "@/src/domains/audit/audit.service";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ correlationId: string }>;
};

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json({ success: false, error: error.message }, { status: error.status });
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requirePermission(request, "audit.view");
    const { correlationId } = await params;
    const trail = await getAuditTrailByCorrelationId(correlationId);

    return NextResponse.json({ success: true, trail });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load correlation audit trail." },
      { status: 500 }
    );
  }
}
