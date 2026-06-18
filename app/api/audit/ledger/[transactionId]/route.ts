import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getAuditTrailByLedgerTransactionId } from "@/src/domains/audit/audit.service";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ transactionId: string }>;
};

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json({ success: false, error: error.message }, { status: error.status });
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requirePermission(request, "audit.view");
    const { transactionId } = await params;
    const trail = await getAuditTrailByLedgerTransactionId(transactionId);

    return NextResponse.json({ success: true, trail });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load ledger audit trail." },
      { status: 500 }
    );
  }
}
