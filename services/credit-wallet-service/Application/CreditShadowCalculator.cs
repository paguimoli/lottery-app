using CreditWalletService.Contracts;

namespace CreditWalletService.Application;

public sealed class CreditShadowCalculator
{
    public CreditShadowEvaluation Evaluate(
        CreditShadowOperationType operationType,
        CreditShadowExecuteRequest request)
    {
        var validationMessages = ValidateRequest(operationType, request);

        if (validationMessages.Count > 0)
        {
            throw new ArgumentException(string.Join(" ", validationMessages));
        }

        var availableCreditAfter = CalculateAvailableCreditAfter(operationType, request);
        var reservedAmount = operationType == CreditShadowOperationType.RESERVE
            ? request.AmountMinor
            : null as long?;
        var releasedAmount = operationType is CreditShadowOperationType.RELEASE or CreditShadowOperationType.SETTLEMENT
            ? (request.ReleasedAmountBefore ?? 0) + request.AmountMinor
            : null as long?;
        var remainingExposure = operationType is CreditShadowOperationType.RELEASE or CreditShadowOperationType.SETTLEMENT
            ? request.RemainingExposureBefore - request.AmountMinor
            : null;
        var balanceImpact = operationType == CreditShadowOperationType.SETTLEMENT
            ? request.BalanceImpactMinor
            : null;

        var calculated = new CreditShadowCalculatedResult(
            operationType,
            request.AccountId.Trim(),
            string.IsNullOrWhiteSpace(request.WalletId) ? null : request.WalletId.Trim(),
            string.IsNullOrWhiteSpace(request.TicketId) ? null : request.TicketId.Trim(),
            string.IsNullOrWhiteSpace(request.ReservationId) ? null : request.ReservationId.Trim(),
            request.AmountMinor,
            request.Currency.Trim(),
            availableCreditAfter,
            reservedAmount,
            releasedAmount,
            remainingExposure,
            balanceImpact,
            true,
            Array.Empty<string>());

        var mismatches = Compare(calculated, request.ExpectedMonolithResult);
        var comparisonStatus = request.ExpectedMonolithResult is null
            ? CreditShadowComparisonStatus.NOT_COMPARED
            : mismatches.Count == 0
                ? CreditShadowComparisonStatus.MATCH
                : CreditShadowComparisonStatus.MISMATCH;

        return new CreditShadowEvaluation(calculated, comparisonStatus, mismatches);
    }

    private static List<string> ValidateRequest(
        CreditShadowOperationType operationType,
        CreditShadowExecuteRequest request)
    {
        var messages = new List<string>();

        if (string.IsNullOrWhiteSpace(request.AccountId))
        {
            messages.Add("accountId is required.");
        }

        if (request.AmountMinor <= 0)
        {
            messages.Add("amountMinor must be a positive integer minor-unit value.");
        }

        if (!IsIso4217Currency(request.Currency))
        {
            messages.Add("currency must be an ISO-4217 uppercase code.");
        }

        if (operationType is CreditShadowOperationType.RELEASE or CreditShadowOperationType.SETTLEMENT)
        {
            if (string.IsNullOrWhiteSpace(request.ReservationId))
            {
                messages.Add("reservationId is required.");
            }

            if (request.RemainingExposureBefore is null)
            {
                messages.Add("remainingExposureBefore is required for release and settlement shadow operations.");
            }
            else if (request.RemainingExposureBefore < request.AmountMinor)
            {
                messages.Add("release amount cannot exceed remaining exposure.");
            }
        }

        if (operationType == CreditShadowOperationType.SETTLEMENT &&
            request.BalanceImpactMinor is null)
        {
            messages.Add("balanceImpactMinor is required for settlement shadow operations.");
        }

        return messages;
    }

    private static long? CalculateAvailableCreditAfter(
        CreditShadowOperationType operationType,
        CreditShadowExecuteRequest request)
    {
        if (request.AvailableCreditBefore is null)
        {
            return null;
        }

        return operationType switch
        {
            CreditShadowOperationType.RESERVE =>
                request.AvailableCreditBefore - request.AmountMinor,
            CreditShadowOperationType.RELEASE =>
                request.AvailableCreditBefore + request.AmountMinor,
            CreditShadowOperationType.SETTLEMENT =>
                request.AvailableCreditBefore + request.AmountMinor + (request.BalanceImpactMinor ?? 0),
            _ => request.AvailableCreditBefore
        };
    }

    private static IReadOnlyList<CreditShadowMismatchDto> Compare(
        CreditShadowCalculatedResult calculated,
        CreditShadowExpectedResult? expected)
    {
        if (expected is null)
        {
            return Array.Empty<CreditShadowMismatchDto>();
        }

        var mismatches = new List<CreditShadowMismatchDto>();

        AddIfMismatch(
            mismatches,
            "amountMinor",
            expected.AmountMinor,
            calculated.AmountMinor,
            "RESERVATION_AMOUNT_MISMATCH");
        AddIfMismatch(
            mismatches,
            "availableCreditAfter",
            expected.AvailableCreditAfter,
            calculated.AvailableCreditAfter,
            "AVAILABLE_CREDIT_MISMATCH");
        AddIfMismatch(
            mismatches,
            "reservedAmount",
            expected.ReservedAmount,
            calculated.ReservedAmount,
            "RESERVATION_AMOUNT_MISMATCH");
        AddIfMismatch(
            mismatches,
            "releasedAmount",
            expected.ReleasedAmount,
            calculated.ReleasedAmount,
            "EXPOSURE_MISMATCH");
        AddIfMismatch(
            mismatches,
            "remainingExposure",
            expected.RemainingExposure,
            calculated.RemainingExposure,
            "EXPOSURE_MISMATCH");
        AddIfMismatch(
            mismatches,
            "balanceImpact",
            expected.BalanceImpact,
            calculated.BalanceImpact,
            "SETTLEMENT_CREDIT_MISMATCH");
        AddIfMismatch(
            mismatches,
            "currency",
            expected.Currency,
            calculated.Currency,
            "CURRENCY_MISMATCH");

        return mismatches;
    }

    private static void AddIfMismatch(
        List<CreditShadowMismatchDto> mismatches,
        string field,
        long? expected,
        long? actual,
        string mismatchType)
    {
        if (expected is null)
        {
            return;
        }

        if (expected == actual)
        {
            return;
        }

        mismatches.Add(new CreditShadowMismatchDto(
            field,
            expected.Value.ToString(),
            actual?.ToString() ?? string.Empty,
            mismatchType,
            GetSeverity(mismatchType)));
    }

    private static void AddIfMismatch(
        List<CreditShadowMismatchDto> mismatches,
        string field,
        string? expected,
        string? actual,
        string mismatchType)
    {
        if (expected is null)
        {
            return;
        }

        var normalizedActual = actual ?? string.Empty;

        if (expected == normalizedActual)
        {
            return;
        }

        mismatches.Add(new CreditShadowMismatchDto(
            field,
            expected,
            normalizedActual,
            mismatchType,
            GetSeverity(mismatchType)));
    }

    private static string GetSeverity(string mismatchType)
    {
        return mismatchType switch
        {
            "AVAILABLE_CREDIT_MISMATCH" => "CRITICAL",
            "RESERVATION_AMOUNT_MISMATCH" => "CRITICAL",
            "EXPOSURE_MISMATCH" => "CRITICAL",
            "SETTLEMENT_CREDIT_MISMATCH" => "CRITICAL",
            "CURRENCY_MISMATCH" => "CRITICAL",
            _ => "WARNING"
        };
    }

    private static bool IsIso4217Currency(string? currency)
    {
        return !string.IsNullOrWhiteSpace(currency)
            && currency.Length == 3
            && currency.All(static character => character is >= 'A' and <= 'Z');
    }
}

public sealed record CreditShadowEvaluation(
    CreditShadowCalculatedResult CalculatedResult,
    CreditShadowComparisonStatus ComparisonStatus,
    IReadOnlyList<CreditShadowMismatchDto> Mismatches);
