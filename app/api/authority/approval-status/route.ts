import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getAuthorityApprovalStatus } from "@/src/domains/authority-approval/authority-approval.service";
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

function parseAuthorityCandidate(value: string | null): AuthorityDomain {
  if (value === "LEDGER" || value === "CREDIT" || value === "SETTLEMENT") {
    return value;
  }

  return "SETTLEMENT";
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const url = new URL(request.url);
    const approvalStatus = await getAuthorityApprovalStatus(
      parseAuthorityCandidate(url.searchParams.get("authorityCandidate"))
    );

    return NextResponse.json({
      success: true,
      approvalStatus,
    });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) {
      return authErrorResponse(error);
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load authority approval status.",
      },
      { status: 500 }
    );
  }
}
