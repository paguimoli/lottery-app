using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using CreditWalletService.Application;
using CreditWalletService.Configuration;
using CreditWalletService.Contracts;

namespace CreditWalletService.Infrastructure;

public sealed class CreditShadowPersistence
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly IHttpClientFactory httpClientFactory;
    private readonly ServiceConfiguration configuration;
    private readonly ILogger<CreditShadowPersistence> logger;

    public CreditShadowPersistence(
        IHttpClientFactory httpClientFactory,
        ServiceConfiguration configuration,
        ILogger<CreditShadowPersistence> logger)
    {
        this.httpClientFactory = httpClientFactory;
        this.configuration = configuration;
        this.logger = logger;
    }

    public async Task<string?> PersistRunAsync(
        CreditShadowOperationType operationType,
        CreditShadowExecuteRequest request,
        CreditShadowEvaluation evaluation,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured())
        {
            logger.LogInformation("Credit shadow persistence skipped because Supabase is not configured.");
            return null;
        }

        var calculated = evaluation.CalculatedResult;
        var expected = request.ExpectedMonolithResult;
        var run = await InsertSingleAsync<InsertedId>(
            "credit_shadow_runs",
            new
            {
                correlation_id = request.CorrelationId,
                operation_type = operationType.ToString(),
                account_id = calculated.AccountId,
                wallet_id = calculated.WalletId,
                ticket_id = calculated.TicketId,
                reservation_id = calculated.ReservationId,
                comparison_status = evaluation.ComparisonStatus.ToString(),
                shadow_amount_minor = calculated.AmountMinor,
                monolith_amount_minor = expected?.AmountMinor,
                shadow_available_credit = calculated.AvailableCreditAfter,
                monolith_available_credit = expected?.AvailableCreditAfter,
                shadow_reserved_amount = calculated.ReservedAmount,
                monolith_reserved_amount = expected?.ReservedAmount,
                shadow_released_amount = calculated.ReleasedAmount,
                monolith_released_amount = expected?.ReleasedAmount,
                shadow_remaining_exposure = calculated.RemainingExposure,
                monolith_remaining_exposure = expected?.RemainingExposure,
                shadow_balance_impact = calculated.BalanceImpact,
                monolith_balance_impact = expected?.BalanceImpact,
                currency = calculated.Currency,
                shadow_service_version = "0.1.0"
            },
            cancellationToken);

        if (run?.Id is null)
        {
            return null;
        }

        foreach (var mismatch in evaluation.Mismatches)
        {
            await InsertSingleAsync<InsertedId>(
                "credit_shadow_mismatches",
                new
                {
                    shadow_run_id = run.Id,
                    mismatch_type = mismatch.MismatchType,
                    field_name = mismatch.Field,
                    monolith_value = mismatch.Expected,
                    shadow_value = mismatch.Actual,
                    severity = mismatch.Severity
                },
                cancellationToken);
        }

        return run.Id;
    }

    public async Task PersistFailureAsync(
        CreditShadowExecuteRequest? request,
        string correlationId,
        string failureType,
        string failureReason,
        IReadOnlyDictionary<string, object?>? metadata,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured())
        {
            logger.LogInformation("Credit shadow failure persistence skipped because Supabase is not configured.");
            return;
        }

        await InsertSingleAsync<InsertedId>(
            "credit_shadow_failures",
            new
            {
                correlation_id = correlationId,
                reservation_id = request?.ReservationId,
                ticket_id = request?.TicketId,
                failure_reason = failureReason,
                failure_type = failureType,
                metadata = metadata ?? new Dictionary<string, object?>()
            },
            cancellationToken);
    }

    private bool IsConfigured()
    {
        return !string.IsNullOrWhiteSpace(configuration.Supabase.Url) &&
               !string.IsNullOrWhiteSpace(configuration.Supabase.ServiceRoleKey);
    }

    private async Task<T?> InsertSingleAsync<T>(
        string table,
        object payload,
        CancellationToken cancellationToken) where T : class
    {
        var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{configuration.Supabase.Url.TrimEnd('/')}/rest/v1/{table}?select=id");
        var serialized = JsonSerializer.Serialize(payload, JsonOptions);

        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            configuration.Supabase.ServiceRoleKey);
        request.Headers.Add("apikey", configuration.Supabase.ServiceRoleKey);
        request.Headers.Add("Prefer", "return=representation");
        request.Content = new StringContent(serialized, Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning(
                "Credit shadow persistence failed. Table={Table} StatusCode={StatusCode} Response={Response}",
                table,
                (int)response.StatusCode,
                responseBody);
            return default;
        }

        var rows = JsonSerializer.Deserialize<List<T>>(responseBody, JsonOptions);
        return rows?.FirstOrDefault();
    }

    private sealed record InsertedId([property: JsonPropertyName("id")] string Id);
}
