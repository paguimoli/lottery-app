import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getAuditTrailByReservationId } from "@/src/domains/audit/audit.service";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ reservationId: string }>;
};

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json({ success: false, error: error.message }, { status: error.status });
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requirePermission(request, "audit.view");
    const { reservationId } = await params;
    const trail = await getAuditTrailByReservationId(reservationId);

    return NextResponse.json({ success: true, trail });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load reservation audit trail." },
      { status: 500 }
    );
  }
}
