import type { AuthorityApprovalRecord } from "../authority-approval/authority-approval.types";
import { listAuthorityApprovalRecords } from "../authority-approval/authority-approval.repository";

export async function listCreditAuthorityApprovalRecords(): Promise<
  AuthorityApprovalRecord[]
> {
  return listAuthorityApprovalRecords({ authorityCandidate: "CREDIT" });
}
