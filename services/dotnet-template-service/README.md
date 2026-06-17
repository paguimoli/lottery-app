# .NET Template Service

This service is the first .NET extraction skeleton for the lottery platform. It
exists to prove runtime, observability, configuration, Docker, RabbitMQ
connectivity, and Redis connectivity before any business logic is moved.

No business logic lives here yet.

## Purpose

- Provide a production-shaped ASP.NET Core Web API template targeting .NET 10.
- Establish health endpoints for liveness and readiness.
- Validate RabbitMQ and Redis configuration/connectivity.
- Provide correlation ID middleware and structured JSON console logging.

## Endpoints

- `GET /health`
- `GET /health/live`
- `GET /health/ready`

Readiness checks validate:

- `RABBITMQ_URL` can be reached over TCP.
- `REDIS_URL` responds to `PING`.

## Environment Variables

- `SERVICE_NAME`
- `ASPNETCORE_ENVIRONMENT`
- `RABBITMQ_URL`
- `RABBITMQ_EXCHANGE_NAME`
- `REDIS_URL`

Inside Docker Compose:

- `RABBITMQ_URL=amqp://lottery:lottery_dev_password@rabbitmq:5672`
- `REDIS_URL=redis://redis:6379`

## Validation Commands

```bash
dotnet build services/dotnet-template-service
docker compose config
docker compose up -d --build
docker compose ps
curl http://localhost:5100/health
curl http://localhost:5100/health/live
curl http://localhost:5100/health/ready
```

## Rules

- Do not move ledger logic here yet.
- Do not move wallet logic here yet.
- Do not move cashier logic here yet.
- Do not move settlement or draw logic here yet.
- Do not publish business events from this service yet.
- Do not use Redis for business logic or financial source-of-truth data.
