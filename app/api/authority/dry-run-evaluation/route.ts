import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getSettlementDryRunEvaluation } from "@/src/domains/authority-approval/authority-approval.service";

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

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const dryRunEvaluation = await getSettlementDryRunEvaluation();

    return NextResponse.json({
      success: true,
      dryRunEvaluation,
    });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) {
      return authErrorResponse(error);
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to evaluate settlement authority dry run.",
      },
      { status: 500 }
    );
  }
}
