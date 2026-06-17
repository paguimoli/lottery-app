namespace DotnetTemplateService.Middleware;

public sealed class CorrelationIdMiddleware
{
    private const string CorrelationIdHeaderName = "x-correlation-id";
    private readonly RequestDelegate next;
    private readonly ILogger<CorrelationIdMiddleware> logger;

    public CorrelationIdMiddleware(
        RequestDelegate next,
        ILogger<CorrelationIdMiddleware> logger)
    {
        this.next = next;
        this.logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = GetOrCreateCorrelationId(context);
        context.Response.Headers[CorrelationIdHeaderName] = correlationId;

        using var scope = logger.BeginScope(new Dictionary<string, object>
        {
            ["ServiceName"] = "dotnet-template-service",
            ["CorrelationId"] = correlationId
        });

        await next(context);
    }

    private static string GetOrCreateCorrelationId(HttpContext context)
    {
        var headerValue = context.Request.Headers[CorrelationIdHeaderName].FirstOrDefault();

        return string.IsNullOrWhiteSpace(headerValue)
            ? Guid.NewGuid().ToString("N")
            : headerValue.Trim();
    }
}
