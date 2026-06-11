import {
  failedResult,
  getStake,
  getTemporaryPayout,
  lossResult,
  type SettlementEvaluationInput,
  winResult,
} from "./settlement-evaluator.types";

function normalizeUpDownResult(result: string) {
  return result === "tie" ? "ud_tie" : result;
}

export function evaluateUpDown(input: SettlementEvaluationInput) {
  if (!input.drawMetrics) {
    return failedResult({ reason: "Draw metrics are required." });
  }

  if (!input.wagerOption?.code) {
    return failedResult({ reason: "Wager option is required." });
  }

  const result = normalizeUpDownResult(input.drawMetrics.upDownResult);
  const optionCode = input.wagerOption.code;
  const metadata = {
    lowCount: input.drawMetrics.lowCount,
    highCount: input.drawMetrics.highCount,
    upDownResult: result,
    optionCode,
  };

  if (optionCode === result) {
    return winResult({
      stake: getStake(input),
      payout: getTemporaryPayout(input),
      reason: "Up/Down option matched result.",
      metadata,
    });
  }

  return lossResult({
    stake: getStake(input),
    reason: "Up/Down option did not match result.",
    metadata,
  });
}
