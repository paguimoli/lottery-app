import { supabaseServerAdmin } from "@/src/lib/supabase/server-admin-client";
import type {
  AuthorityApprovalRecord,
  AuthorityApprovalType,
} from "./authority-approval.types";
import type { AuthorityDomain } from "../authority-control/authority-control.types";

type AuthorityApprovalRow = {
  id: string;
  authority_candidate: AuthorityDomain;
  approval_type: AuthorityApprovalType;
  approver_user_id?: string | null;
  approver_username?: string | null;
  justification: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

const APPROVAL_SELECT =
  "id, authority_candidate, approval_type, approver_user_id, approver_username, justification, metadata, created_at";

export class AuthorityApprovalRepositoryError extends Error {
  constructor(message = "Authority approval persistence operation failed.") {
    super(message);
    this.name = "AuthorityApprovalRepositoryError";
  }
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.message?.includes("authority_approval_records") ||
    error.message?.toLowerCase().includes("does not exist")
  );
}

function mapApproval(row: AuthorityApprovalRow): AuthorityApprovalRecord {
  return {
    id: row.id,
    authorityCandidate: row.authority_candidate,
    approvalType: row.approval_type,
    approverUserId: row.approver_user_id ?? null,
    approverUsername: row.approver_username ?? null,
    justification: row.justification,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export async function listAuthorityApprovalRecords({
  authorityCandidate,
}: {
  authorityCandidate?: AuthorityDomain;
} = {}): Promise<AuthorityApprovalRecord[]> {
  let query = supabaseServerAdmin
    .from("authority_approval_records")
    .select(APPROVAL_SELECT)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (authorityCandidate) {
    query = query.eq("authority_candidate", authorityCandidate);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error)) return [];

    throw new AuthorityApprovalRepositoryError(error.message);
  }

  return ((data ?? []) as AuthorityApprovalRow[]).map(mapApproval);
}
