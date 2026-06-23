import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getLedgerAuthorityReadiness } from "@/src/domains/ledger-authority/ledger-authority.service";

export const runtime = "nodejs";

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json({ success: false, error: error.message }, { status: error.status });
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const readiness = await getLedgerAuthorityReadiness();

    return NextResponse.json({ success: true, readiness });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load ledger authority readiness." },
      { status: 500 }
    );
  }
}
