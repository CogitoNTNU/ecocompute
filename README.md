# EcoCompute

An AI infrastructure experiment: chat with GPT-4.1 Nano or GPT-6 Luna through
an autoscaling or always-on Azure Container App, then compare measured request
performance with Azure-reported costs.

## Structure

```text
frontend/                    React + TypeScript + Vite
  src/
    components/              Shared UI primitives
    features/chat/           Chat controls, conversation and request state
    features/costs/          Billing charts and session comparison
    lib/                     Validated API contracts and measurement functions
  tests/                     Playwright browser tests (mocked cloud services)
backend/
  app/
    api/                     HTTP routes and injected service dependencies
    core/                    Server configuration, errors and request limits
    schemas/                 Validated request/response contracts
    services/                Foundry and Azure billing adapters
    main.py                  Application composition and static React hosting
  tests/                     API and service tests
  Dockerfile                 Multi-stage frontend/backend build
infra/terraform/azure/       Azure resources and remote state configuration
docs/                       Architecture and deployment guides
.github/workflows/           Validation and deployment
```

The frontend uses Tailwind CSS through its Vite plugin. Edit utility classes in
the React components to change their styling; shared colors, animation and
document defaults live in `frontend/src/styles.css`. The `wide`, `compact`,
`tablet` and `mobile` variants retain the existing 1600px, 1200px, 1000px and
700px breakpoints. Exact pixel values and the existing base styles preserve the
design's 14px root font size; Tailwind Preflight is intentionally omitted.
Run `npm --prefix frontend run format` to format code and sort utility classes.

## Run locally

Use Python 3.12+, uv, and Node.js 24+.

Run `make setup` once to install dependencies, install the Chromium test browser,
and copy `.env.example` to `.env` if one does not already exist. Existing `.env`
values are preserved. Set the Foundry
API key. Both deployments use `https://ecollm.openai.azure.com/openai/v1/`:
`AZURE_OPENAI_DEPLOYMENT=gpt-4.1-nano` and
`AZURE_OPENAI_LUNA_DEPLOYMENT=gpt-6-luna`. No key goes into the browser.

From the repository root:

```sh
make setup
az login       # Needed for live billing, not for automated tests or API-key chat
make dev
```

Open http://127.0.0.1:5173. `make dev` starts the API and React development
servers with reload; Ctrl+C stops both. It does not deploy anything. If a preview
is already using port 8000, stop it or choose different ports:

```sh
make dev BACKEND_PORT=8001 FRONTEND_PORT=5174
```

For separate terminals, use `make backend` and `make frontend`. Vite proxies
`/api` to the selected local backend port (8000 by default).
The default local configuration enables **always-on** only. Unconfigured backend
URLs or model deployments appear unavailable; no backend or model is silently
substituted. This local label is not an Azure scaling simulation.

To use the deployed pair, set `BACKEND_URLS_JSON` using the URLs in
`.env.example`, deploy this API version to both apps, and include your local UI
origin in Terraform's `additional_frontend_origins`. Your public IP must also
match the apps' ingress allowlist. Backend and model choices affect the next
request, while conversation context stays in the current chat.

## Cost explorer

The cost page queries Azure Cost Management through the Python backend. It
shows daily, actual pre-tax costs for configured resources in a single
subscription, in the currency Azure returns. Azure billing is delayed; the
period excludes the current UTC day. Responses are cached for 15 minutes.

Local setup:

1. Run `az login` with an identity that can read costs for the subscription.
2. The current subscription and verified resource IDs are already in `.env.example`.
3. If the infrastructure changes, update `AZURE_COST_RESOURCES_JSON` from
   Terraform's `cost_resource_ids` output, including the Foundry account resource ID.

The mapping contains `autoscale`, `always-on`, `foundry`, and `shared` arrays of
resource IDs. A resource must appear in only one category. Unconfigured
categories show “—”; unavailable or empty billing never becomes a fabricated
zero-cost report. Foundry totals can include other workloads in the same account.

Session comparisons show request attempts, successful round-trip latency,
input/output tokens and p95 for each backend/model combination. These are
in-memory browser measurements, cleared on refresh and exportable as JSON.
They are separate from the invoice. Failed/cancelled calls may still incur
Foundry usage. The app does not claim to detect cold starts or live replica counts.

## Checks

```sh
make test             # Backend/API and frontend unit tests
make test-e2e         # Browser tests; starts its own server on port 4173
make check            # Formatting checks, production build and all app tests
make terraform-check # Provider initialization and validation only; no deployment
```

Tests mock Foundry and Azure billing; they do not make paid API calls.
They do not need Azure credentials. Dependency/browser installation and Terraform
provider initialization can require network access. `make help` lists all commands.

## Local testing versus Azure deployment

| What you want to check | Where it runs | Push/deploy needed? |
| --- | --- | --- |
| UI, input validation, routing and automated tests | Your computer, mocked cloud services | No |
| Real Nano/Luna replies | Local API calling the existing Foundry deployments | No; needs the API key and incurs model usage |
| Real billing dashboard | Local API reading Azure Cost Management | No; needs `az login` and billing access |
| Actual scale-to-zero, replicas, startup latency and infrastructure cost | Deployed Azure Container Apps | Yes, deploy this backend version to both apps |

Pushing code alone does not deploy with the current workflow. Push the changes
to the deployment branch, then manually run **Deploy to Azure** in GitHub Actions.
The `deploy.yml` workflow runs the reusable `checks.yml` workflow for that same
commit first. Deployment starts only when all backend, frontend and Terraform
checks succeed; a failed or cancelled check prevents deployment.
The frontend can still run locally against the deployed backends after configuring
their URLs and allowed origins as described above. Local processes do not simulate
Azure autoscaling.

## Docker and Azure

From the repository root:

```sh
docker build -f backend/Dockerfile -t ecocompute .
docker run --rm --env-file .env -p 8000:8000 ecocompute
```

The image builds React and serves it with FastAPI as a non-root user. Both
`/` and `/costs` support direct navigation. API routes live under `/api` and
health checks at `/health`.

See [Azure setup](docs/azure.md) and [architecture and measurement notes](docs/architecture.md).
