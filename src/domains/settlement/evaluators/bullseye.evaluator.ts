import {
  failedResult,
  getStake,
  lossResult,
  type SettlementEvaluationInput,
  winResult,
} from "./settlement-evaluator.types";

export function evaluateBullseye(input: SettlementEvaluationInput) {
  const selectedNumbers = input.ticketLine.selectedNumbers || [];

  if (selectedNumbers.length === 0) {
    return failedResult({ reason: "Selected numbers are required." });
  }

  if (input.bullseyeNumber === null || input.bullseyeNumber === undefined) {
    return failedResult({ reason: "Bullseye number is required." });
  }

  const winningNumberSet = new Set(input.winningNumbers);
  const hitCount = selectedNumbers.filter((number) =>
    winningNumberSet.has(number)
  ).length;
  const spotCount = selectedNumbers.length;
  const bullseyeHit = selectedNumbers.includes(input.bullseyeNumber);
  const matchingRow = input.payTableRows?.find(
    (row) =>
      Number(row.spotCount) === spotCount &&
      Number(row.hitCount) === hitCount &&
      row.bullseyeRequired === true
  );
  const payout = Number(matchingRow?.payout || 0);
  const metadata = {
    spotCount,
    hitCount,
    bullseyeNumber: input.bullseyeNumber,
    bullseyeHit,
  };

  if (bullseyeHit && payout > 0) {
    return winResult({
      stake: getStake(input),
      payout,
      reason: "Bullseye paytable row matched.",
      metadata,
    });
  }

  return lossResult({
    stake: getStake(input),
    reason: "Bullseye condition or paytable payout did not match.",
    metadata,
  });
}
