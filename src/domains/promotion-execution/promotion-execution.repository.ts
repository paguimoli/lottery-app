import type { AuthorityDomain } from "../authority-control/authority-control.types";

export function assertSupportedPromotionExecutionDomain(
  domain: AuthorityDomain
): asserts domain is "SETTLEMENT" {
  if (domain !== "SETTLEMENT") {
    throw new Error(`${domain} promotion execution is not implemented yet.`);
  }
}
