# RelayFlow

RelayFlow is a backend workflow automation platform inspired by tools such as Zapier and n8n.

It allows users to define workflows, trigger them manually or through webhooks, execute workflow steps asynchronously using background workers, and track the execution lifecycle.

The project focuses on backend architecture, asynchronous processing, reliability, security, and observability.

---

## Features

- JWT authentication
- Workflow creation and lifecycle management
- Manual and webhook triggers
- Workflow versioning and execution snapshots
- Asynchronous execution with BullMQ
- Separate API and Worker processes
- Step-level execution tracking
- Transform steps
- Filter steps
- HTTP request steps
- Retry with exponential backoff
- Resume failed executions without re-running successful steps
- Webhook idempotency
- Encrypted credentials using AES-256-GCM
- Bearer token credentials for HTTP steps
- SSRF protection for outbound HTTP requests
- Safe redirect handling
- Distributed webhook rate limiting with Redis
- Queue backpressure
- Multi-worker processing
- Structured logging with Pino
- Distributed tracing with OpenTelemetry
- Jaeger trace visualization
- Core integration tests

---

## Architecture

RelayFlow is implemented as a modular monolith with two separate runtime processes:

```text
                     ┌──────────────┐
                     │    Client    │
                     └──────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   NestJS API  │
                    └───────┬───────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
        PostgreSQL        Redis          BullMQ
                                             │
                                             ▼
                                    ┌────────────────┐
                                    │ NestJS Worker  │
                                    └───────┬────────┘
                                            │
                                            ▼
                                    Workflow Engine
                                            │
                         ┌──────────────────┼──────────────────┐
                         ▼                  ▼                  ▼
                     TRANSFORM            FILTER        HTTP_REQUEST
```

The API handles HTTP requests, authentication, workflow management, webhook ingestion, and job creation.

The Worker consumes BullMQ jobs and executes workflows through the Workflow Engine.

---

## Tech Stack

- Node.js
- TypeScript
- NestJS
- PostgreSQL
- Prisma ORM
- Redis
- BullMQ
- Zod
- JWT
- Argon2
- Pino
- OpenTelemetry
- Jaeger
- Docker
- Jest
- Supertest

---

## Workflow Execution

When a workflow is triggered, RelayFlow creates an immutable execution snapshot containing:

- Workflow version
- Workflow definition
- Trigger type
- Trigger payload

The execution is then queued in BullMQ.

```text
Trigger
  ↓
Execution created
  ↓
BullMQ
  ↓
Worker
  ↓
Workflow Engine
  ↓
StepExecution records
  ↓
SUCCEEDED / FAILED
```

Each step has its own execution state:

```text
PENDING
RUNNING
SUCCEEDED
FAILED
SKIPPED
```

---

## Supported Steps

### TRANSFORM

Creates a new object using values from the current workflow input.

Example:

```json
{
  "id": "transform-1",
  "type": "TRANSFORM",
  "config": {
    "template": {
      "message": "{{input.message}}"
    }
  }
}
```

---

### FILTER

Stops the workflow when a condition does not match.

Supported operators:

```text
EQUALS
NOT_EQUALS
GREATER_THAN
LESS_THAN
```

Example:

```json
{
  "id": "filter-1",
  "type": "FILTER",
  "config": {
    "field": "priority",
    "operator": "EQUALS",
    "value": "high"
  }
}
```

---

### HTTP_REQUEST

Sends an outbound HTTP request.

Example:

```json
{
  "id": "http-1",
  "type": "HTTP_REQUEST",
  "config": {
    "method": "POST",
    "url": "https://example.com/webhook",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "message": "Hello from RelayFlow"
    }
  }
}
```

HTTP steps also support encrypted Bearer Token credentials through a `credentialId`.

---

## Reliability

### Retry and Backoff

Workflow execution jobs use BullMQ retries with exponential backoff.

```text
Attempt 1
   ↓ failed
2 seconds
   ↓
Attempt 2
   ↓ failed
4 seconds
   ↓
Attempt 3
```

Previously successful steps are not executed again during a retry.

Only the failed step and remaining workflow are resumed.

---

## Webhook Idempotency

Webhook requests can include:

```http
Idempotency-Key: unique-key
```

RelayFlow stores the key together with the workflow execution.

The database enforces:

```text
workflowId + idempotencyKey = unique
```

Sending the same webhook again with the same key returns the existing execution instead of creating another one.

---

## Security

### Credential Encryption

Credentials are encrypted before being stored in PostgreSQL using:

```text
AES-256-GCM
```

Stored fields include:

```text
ciphertext
iv
authTag
```

Plaintext credential data is never returned by the API.

---

### SSRF Protection

Outbound HTTP requests are validated before execution.

RelayFlow blocks requests targeting private or local network addresses such as:

```text
127.0.0.1
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
169.254.0.0/16
localhost
private IPv6 ranges
```

Redirects are manually validated to prevent redirect-based SSRF attacks.

Cross-origin redirects are rejected.

---

## Rate Limiting

Webhook endpoints use a Redis-backed distributed rate limiter.

Current limit:

```text
60 requests
per 60 seconds
per workflow
```

Because the counter is stored in Redis, the limit works across multiple API instances.

---

## Scaling

RelayFlow supports multiple Worker processes consuming from the same BullMQ queue.

Each Worker currently uses:

```text
concurrency: 5
```

and a processing limiter of:

```text
20 jobs / second
```

The API also applies queue backpressure before accepting new workflow executions.

---

## Observability

RelayFlow uses structured logging with Pino.

Logs include business context such as:

```text
executionId
stepId
stepType
attempt
workerPid
```

OpenTelemetry is used for distributed tracing.

Custom spans include:

```text
workflow.execute
workflow.step.execute
```

Trace context is propagated from the API through BullMQ to the Worker.

Example trace:

```text
HTTP Request
   │
   └── workflow.execute
          │
          ├── workflow.step.execute
          │      TRANSFORM
          │
          ├── workflow.step.execute
          │      FILTER
          │
          └── workflow.step.execute
                 HTTP_REQUEST
```

Jaeger can be used locally to inspect traces.

---

## Demo

A real integration was tested using GitHub Issues.

```text
GitHub Issue Created
        ↓
GitHub Webhook
        ↓
Cloudflare Tunnel
        ↓
RelayFlow Webhook API
        ↓
Execution
        ↓
BullMQ
        ↓
Worker
        ↓
HTTP Request Step
        ↓
Webhook.site
```

This demonstrates RelayFlow receiving a real third-party webhook and processing it asynchronously through the complete workflow execution pipeline.

---

## API Overview

### Authentication

```text
POST /auth/register
POST /auth/login
GET  /auth/me
```

### Workflows

```text
POST   /workflows
GET    /workflows
GET    /workflows/:id

PATCH  /workflows/:id
PATCH /workflows/:id/activate
PATCH /workflows/:id/pause

POST /workflows/:id/run
```

### Executions

```text
GET /executions
GET /executions/:id
```

### Webhooks

```text
POST /webhooks/:token
```

### Credentials

```text
POST   /credentials
GET    /credentials
DELETE /credentials/:id
```

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file.

Example:

```env
NODE_ENV=development

API_PORT=3000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/relayflow

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your-access-secret
JWT_ACCESS_TTL_SECONDS=900

CREDENTIAL_ENCRYPTION_KEY=64_CHARACTER_HEX_KEY

OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
```

A 32-byte encryption key can be generated with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 3. Start infrastructure

```bash
docker compose up -d
```

This starts services such as:

```text
PostgreSQL
Redis
Jaeger
```

---

### 4. Generate Prisma Client

```bash
npx prisma generate
```

Run database migrations if required:

```bash
npx prisma migrate dev
```

---

### 5. Start the API

```bash
nest start api --watch
```

---

### 6. Start the Worker

Open another terminal:

```bash
nest start worker --watch
```

---

## Testing

The project contains focused integration tests for the most important application flows.

Run the tests with:

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand
```

Current core scenarios include:

```text
Manual workflow execution creation
Webhook idempotency
```

---

## Project Goals

RelayFlow was built as a backend engineering project to practice concepts commonly found in production systems:

- asynchronous processing
- queues and background workers
- retries
- idempotency
- distributed rate limiting
- horizontal worker scaling
- encrypted secrets
- SSRF protection
- observability
- distributed tracing
- execution state management

The goal is not to replicate every feature of Zapier or n8n, but to build and understand the backend systems that make workflow automation platforms reliable.

---

## Current Status

Core backend functionality is complete.

Remaining improvements include:

- API documentation with Swagger
- CI improvements
- deployment
- additional integrations
- broader automated test coverage

---

## Author

**Arshan Ebrahimifar**

- GitHub: [ArshanEbrahimifar](https://github.com/ArshanEbrahimifar)
- Repository: [relayflow](https://github.com/ArshanEbrahimifar/relayflow)
