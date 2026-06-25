import { NextResponse } from "next/server";

import {
  AuthMiddlewareError,
  requirePermission,
} from "@/src/domains/auth/auth-middleware";
import { getAuthorityApprovalStatus } from "@/src/domains/authority-approval/authority-approval.service";

export const runtime = "nodejs";

function authErrorResponse(error: AuthMiddlewareError) {
  return NextResponse.json({ success: false, error: error.message }, { status: error.status });
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "system.admin");
    const approvalStatus = await getAuthorityApprovalStatus("CREDIT");

    return NextResponse.json({ success: true, approvalStatus });
  } catch (error) {
    if (error instanceof AuthMiddlewareError) return authErrorResponse(error);

    return NextResponse.json(
      { success: false, error: "Unable to load credit approval status." },
      { status: 500 }
    );
  }
}
