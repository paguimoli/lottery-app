using DotnetTemplateService.Configuration;
using DotnetTemplateService.Infrastructure;
using DotnetTemplateService.Middleware;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(options =>
{
    options.IncludeScopes = true;
    options.UseUtcTimestamp = true;
});

var serviceConfiguration = ServiceConfiguration.FromEnvironment(builder.Environment);

builder.Services.AddSingleton(serviceConfiguration);
builder.Services.AddSingleton<InfrastructureReadinessChecks>();

var app = builder.Build();

app.UseMiddleware<CorrelationIdMiddleware>();

app.MapGet("/health", (ServiceConfiguration configuration) =>
{
    return Results.Ok(new
    {
        status = "ok",
        service = configuration.ServiceName,
        environment = configuration.Environment,
        timestamp = DateTimeOffset.UtcNow
    });
});

app.MapGet("/health/live", (ServiceConfiguration configuration) =>
{
    return Results.Ok(new
    {
        status = "ok",
        service = configuration.ServiceName,
        timestamp = DateTimeOffset.UtcNow
    });
});

app.MapGet("/health/ready", async (
    ServiceConfiguration configuration,
    InfrastructureReadinessChecks readinessChecks,
    CancellationToken cancellationToken) =>
{
    var rabbitMqReady = await readinessChecks.CheckRabbitMqAsync(cancellationToken);
    var redisReady = await readinessChecks.CheckRedisAsync(cancellationToken);
    var ready = rabbitMqReady.Ready && redisReady.Ready;

    var response = new
    {
        status = ready ? "ok" : "error",
        service = configuration.ServiceName,
        timestamp = DateTimeOffset.UtcNow,
        dependencies = new
        {
            rabbitMq = rabbitMqReady,
            redis = redisReady
        }
    };

    return ready ? Results.Ok(response) : Results.Json(response, statusCode: 503);
});

app.Run();
