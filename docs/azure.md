# Azure deployment

Terraform's root module is `infra/terraform/azure/`. It creates two Container Apps
using one image and identical CPU/memory allocations:

| App | Replicas | Purpose |
| --- | --- | --- |
| `ecocompute-autoscale` | 0–3 | Scale to zero and respond to demand |
| `ecocompute-always-on` | 1 | Keep capacity available between requests |

Both expose the React UI, `/api/chat`, `/api/config`, `/api/costs`, and `/health`.
An explicit HTTP rule uses a concurrency threshold of 10. Readiness and liveness
probes use `/health`; these do not call Foundry.

## Existing prerequisites

The remote state account `ecocomputetfstate1234`, container `tfstate`, and state
resource group `terraform-state-rg` must already exist. The state key remains
`ecocompute.tfstate`. Keep the state storage access restricted: provider-managed
secrets are present in state even when their variables are marked sensitive.

The GitHub Azure identity must have an OIDC federated credential matching this
repository's deployment branch and access to the state container, resource group
creation, ACR builds, and the resources managed here. With cost reporting enabled,
it also needs permission to create role assignments at subscription scope.
Configure the identity and state storage separately from this application stack.

The Foundry account and deployments already exist and are not created by this
Terraform configuration. Defaults are `gpt-4.1-nano` and `gpt-6-luna` on
`https://ecollm.openai.azure.com/openai/v1/`.

## Deployment

1. Add GitHub Actions secrets: `AZURE_CLIENT_ID`, `TF_VAR_TENANT_ID`,
   `TF_VAR_SUBSCRIPTION_ID`, and `AZURE_OPENAI_API_KEY`.
2. Set the `ALLOWED_IP_CIDR` repository variable to your public IPv4 address with
   `/32`. It protects both chat and billing routes; unrestricted `/0` is rejected.
3. Check `foundry_resource_ids` in `terraform.tfvars`. It is configured for
   the existing `ecollm` account in resource group `llm-rg`. These are non-secret
   resource identifiers; update them if the Foundry account changes.
4. Review the Terraform changes, then run **Deploy to Azure** from GitHub Actions.
5. Open Terraform's `frontend_url` output, which points to always-on.

The `deploy.yml` workflow first runs the reusable `checks.yml` workflow on the
same commit. All backend, frontend and Terraform checks must pass before the
deployment job can sign in to Azure or change resources. Failed or cancelled
checks prevent deployment. The workflow remains manually triggered.

The workflow builds `backend/Dockerfile` from the repository root. The image
build compiles the React frontend. Both apps receive their correct backend mode,
backend URL mapping, model deployments and exact CORS origins at runtime; the
JavaScript bundle does not embed credentials or environment-specific endpoints.

The workflow still has the existing targeted registry bootstrap step. This is a
known follow-up improvement; moving it out of routine deployments requires
coordinating existing state and the initial image bootstrap.

## Billing access

`enable_cost_reporting` defaults to `true`. Terraform gives each app a
system-assigned managed identity and grants **Cost Management Reader** at the
current subscription. This is read-only billing access; the service queries only
its configured resource IDs. Set the variable to `false` if you do not want the
role assignment or cost integration. Azure billing policies may additionally
restrict cost visibility for your subscription or agreement type.

The configured subscription is derived from the authenticated Terraform identity;
it must be the intended subscription (`7ec1bafb-324b-43b8-9c30-76e35b9d38cd` for
this project). Foundry resource IDs must be in that same subscription.

Terraform assembles the two app IDs, the registry and environment IDs, and any
`foundry_resource_ids`. It does not split shared Foundry costs across models.
Role propagation can take time after deployment; billing errors remain visible
and can be retried. Data is delayed and cached for 15 minutes. See
[measurement boundaries](architecture.md#billing-accuracy).

## Local or separately hosted frontend

Add its exact origin to `additional_frontend_origins` (for example
`http://127.0.0.1:5173`) and set local `BACKEND_URLS_JSON` to the deployed URL map.
Deploy both backends before using the new frontend against Azure: the old `/chat`
contract is replaced by `/api/chat` with explicit model, backend and message history.

Current app URLs:

- Always-on: https://ecocompute-always-on.purplecliff-395c06cb.australiaeast.azurecontainerapps.io
- Autoscale: https://ecocompute-autoscale.purplecliff-395c06cb.australiaeast.azurecontainerapps.io

For local billing, use `az login`, set `AZURE_COST_SUBSCRIPTION_ID`, and copy the
resource map from `terraform output -json cost_resource_ids` into
`AZURE_COST_RESOURCES_JSON`. Never expose Azure credentials through frontend env vars.

## Validate without deployment

```sh
terraform -chdir=infra/terraform/azure init -backend=false
terraform -chdir=infra/terraform/azure fmt -check -recursive
terraform -chdir=infra/terraform/azure validate
```

Before a real plan/apply, run `terraform -chdir=infra/terraform/azure init` to
initialize the remote backend. Changing directory did not change resource
addresses or the state key. No Azure deployment is performed by application tests.
