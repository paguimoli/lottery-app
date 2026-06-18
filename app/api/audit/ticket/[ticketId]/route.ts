import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getAuditTrailByTicketId } from "@/src/domains/audit/audit.service";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ ticketId: string }>;
};

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json({ success: false, error: error.message }, { status: error.status });
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requirePermission(request, "audit.view");
    const { ticketId } = await params;
    const trail = await getAuditTrailByTicketId(ticketId);

    return NextResponse.json({ success: true, trail });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load ticket audit trail." },
      { status: 500 }
    );
  }
}
