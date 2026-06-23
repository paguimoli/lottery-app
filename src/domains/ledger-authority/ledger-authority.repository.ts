import type { AuthorityApprovalRecord } from "../authority-approval/authority-approval.types";
import { listAuthorityApprovalRecords } from "../authority-approval/authority-approval.repository";

export async function listLedgerAuthorityApprovalRecords(): Promise<
  AuthorityApprovalRecord[]
> {
  return listAuthorityApprovalRecords({ authorityCandidate: "LEDGER" });
}
