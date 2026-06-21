import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getAuthorityApprovalHistory } from "@/src/domains/authority-approval/authority-approval.service";
import type { AuthorityDomain } from "@/src/domains/authority-control/authority-control.types";

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

function parseAuthorityCandidate(value: string | null): AuthorityDomain | undefined {
  if (value === "SETTLEMENT" || value === "LEDGER" || value === "CREDIT") {
    return value;
  }

  return undefined;
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const url = new URL(request.url);
    const approvalHistory = await getAuthorityApprovalHistory(
      parseAuthorityCandidate(url.searchParams.get("authorityCandidate"))
    );

    return NextResponse.json({
      success: true,
      approvalHistory,
    });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) {
      return authErrorResponse(error);
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load authority approval history.",
      },
      { status: 500 }
    );
  }
}
