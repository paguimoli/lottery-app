import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getLedgerDryRunEvaluation } from "@/src/domains/ledger-authority/ledger-authority.service";

export const runtime = "nodejs";

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json({ success: false, error: error.message }, { status: error.status });
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const dryRunEvaluation = await getLedgerDryRunEvaluation();

    return NextResponse.json({ success: true, dryRunEvaluation });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load ledger dry-run evaluation." },
      { status: 500 }
    );
  }
}
