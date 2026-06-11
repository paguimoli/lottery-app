import {
  failedResult,
  getStake,
  lossResult,
  type SettlementEvaluationInput,
  winResult,
} from "./settlement-evaluator.types";

export function evaluateHitCount(
  input: SettlementEvaluationInput
) {
  const selectedNumbers = input.ticketLine.selectedNumbers || [];

  if (selectedNumbers.length === 0) {
    return failedResult({ reason: "Selected numbers are required." });
  }

  const winningNumberSet = new Set(input.winningNumbers);
  const matchedNumbers = selectedNumbers.filter((number) =>
    winningNumberSet.has(number)
  );
  const spotCount = selectedNumbers.length;
  const hitCount = matchedNumbers.length;
  const matchingRow = input.payTableRows?.find(
    (row) =>
      Number(row.spotCount) === spotCount &&
      Number(row.hitCount) === hitCount &&
      !row.bullseyeRequired
  );
  const payout = Number(matchingRow?.payout || 0);
  const metadata = { spotCount, hitCount, matchedNumbers };

  if (payout > 0) {
    return winResult({
      stake: getStake(input),
      payout,
      reason: "Hit-count paytable row matched.",
      metadata,
    });
  }

  return lossResult({
    stake: getStake(input),
    reason: "No winning hit-count paytable row matched.",
    metadata,
  });
}
