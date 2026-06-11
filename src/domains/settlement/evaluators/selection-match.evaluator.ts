import {
  failedResult,
  getStake,
  getTemporaryPayout,
  lossResult,
  type SettlementEvaluationInput,
  winResult,
} from "./settlement-evaluator.types";

function normalizeResultValue(value: unknown) {
  if (value === "tie") {
    return ["tie", "dt_tie", "ud_tie"];
  }

  return [String(value)];
}

export function evaluateSelectionMatch(input: SettlementEvaluationInput) {
  const metricKey = input.wagerType.metricKey;

  if (!input.drawMetrics || !metricKey) {
    return failedResult({
      reason: "Selection match requires draw metrics and target metric key.",
      metadata: { metricKey },
    });
  }

  if (!input.wagerOption?.code) {
    return failedResult({ reason: "Wager option is required." });
  }

  const resultValue = input.drawMetrics[metricKey as keyof typeof input.drawMetrics];

  if (resultValue === undefined || resultValue === null) {
    return failedResult({
      reason: "Selection match target result field was not found.",
      metadata: { metricKey },
    });
  }

  const normalizedValues = normalizeResultValue(resultValue);
  const metadata = {
    metricKey,
    resultValue,
    normalizedValues,
    optionCode: input.wagerOption.code,
  };

  if (normalizedValues.includes(input.wagerOption.code)) {
    return winResult({
      stake: getStake(input),
      payout: getTemporaryPayout(input),
      reason: "Selection matched target result.",
      metadata,
    });
  }

  return lossResult({
    stake: getStake(input),
    reason: "Selection did not match target result.",
    metadata,
  });
}
