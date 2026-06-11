import {
  compareValues,
  getNumericMetric,
} from "./metric-threshold.evaluator";
import {
  failedResult,
  getStake,
  getTemporaryPayout,
  lossResult,
  type SettlementEvaluationInput,
  winResult,
} from "./settlement-evaluator.types";

const counterpartMetricByKey: Record<string, string> = {
  oddCount: "evenCount",
  evenCount: "oddCount",
  highCount: "lowCount",
  lowCount: "highCount",
};

export function inferCounterpartMetric(metricKey?: string) {
  return metricKey ? counterpartMetricByKey[metricKey] : undefined;
}

export function evaluateMetricComparison(input: SettlementEvaluationInput) {
  const metricKey = input.wagerType.metricKey;
  const counterpartMetricKey = inferCounterpartMetric(metricKey);
  const operator = input.wagerType.comparisonOperator;
  const leftValue = getNumericMetric(input, metricKey);
  const rightValue = getNumericMetric(input, counterpartMetricKey);

  if (!metricKey || !counterpartMetricKey || !operator || leftValue === null || rightValue === null) {
    return failedResult({
      reason: "Metric comparison configuration is incomplete.",
      metadata: { metricKey, counterpartMetricKey, operator },
    });
  }

  const matched = compareValues(leftValue, operator, rightValue);
  const metadata = {
    metricKey,
    metricValue: leftValue,
    counterpartMetricKey,
    counterpartMetricValue: rightValue,
    operator,
  };

  if (matched) {
    return winResult({
      stake: getStake(input),
      payout: getTemporaryPayout(input),
      reason: "Metric comparison condition matched.",
      metadata,
    });
  }

  return lossResult({
    stake: getStake(input),
    reason: "Metric comparison condition did not match.",
    metadata,
  });
}
