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
2. Register a multitenant Microsoft Entra app in the project's existing
   directory as described under [Organization sign-in](#organization-sign-in).
   Set the GitHub Actions repository variables `ENTRA_TENANT_ID` to NTNU's
   tenant ID and `ENTRA_CLIENT_ID` to the app's client ID. Keep
   `ALLOWED_IP_CIDR` set to the old restricted CIDR for the first rollout.
   Deployment fails closed if either required Entra ID is missing.
3. Check `foundry_resource_ids` in `terraform.tfvars`. It is configured for
   the existing `ecollm` account in resource group `llm-rg`. These are non-secret
   resource identifiers; update them if the Foundry account changes.
4. Review the Terraform changes, then run **Deploy to Azure** from GitHub Actions.
5. Open Terraform's `frontend_url` output, which points to always-on.

The `deploy.yml` workflow first runs the reusable `checks.yml` workflow on the
same commit. All backend, frontend and Terraform checks must pass before the
deployment job can sign in to Azure or change resources. Failed or cancelled
checks prevent deployment. The workflow remains manually triggered.

If an existing app still has an IP rule, the workflow first deploys the new
authenticated image while retaining that rule. A second Terraform plan/apply
then removes it. New installations go directly to the authenticated public
configuration. Subsequent deployments avoid re-adding the restriction.

The workflow builds `backend/Dockerfile` from the repository root. The image
build compiles the React frontend. Both apps receive their correct backend mode,
backend URL mapping, model deployments and exact CORS origins at runtime; the
JavaScript bundle does not embed credentials or environment-specific endpoints.

The workflow still has the existing targeted registry bootstrap step. This is a
known follow-up improvement; moving it out of routine deployments requires
coordinating existing state and the initial image bootstrap.

### Organization sign-in

The ingress IP allowlist is removed, so anyone can load the sign-in page from
eduroam, a VPN, or another network. `/health` and `/api/config` are public;
`/api/chat` and `/api/costs` require a valid Microsoft Entra access token issued
by NTNU's tenant to one of its member accounts. The optional NTNU group setting
can narrow this to a smaller set. An email-like username is displayed after
sign-in but is not trusted for API authorization. This policy covers NTNU tenant
members; it does not prove that each account's current mailbox ends in
`@ntnu.no`. If the exact address rule is essential, NTNU IT must provide an
authoritative group or other directory-managed attribute.

Do not create a new directory named NTNU. The project subscription already has
an Entra directory for its deployment identity and app registration. NTNU
accounts remain in NTNU's separate directory. Registering a multitenant app in
the project directory does not grant control over NTNU identities or require
linking the directories.

In the Microsoft Entra admin center, switch to the project's directory
(`800853e7-a053-4c47-8ad0-03bd92e06966`), then open **Entra ID → App
registrations → New registration**. The following **Authentication** menu is
inside that new app registration under **Manage**; it is not the Container App
or **Enterprise applications** page.

1. Create an app registration with **Accounts in any organizational directory**.
   After registration, open **Manage → Authentication → Add a platform →
   Single-page application** and add these four redirect URIs:

   - `https://ecocompute-always-on.purplecliff-395c06cb.australiaeast.azurecontainerapps.io`
   - `https://ecocompute-always-on.purplecliff-395c06cb.australiaeast.azurecontainerapps.io/blank.html`
   - `https://ecocompute-autoscale.purplecliff-395c06cb.australiaeast.azurecontainerapps.io`
   - `https://ecocompute-autoscale.purplecliff-395c06cb.australiaeast.azurecontainerapps.io/blank.html`

   Record the **Application (client) ID**. This SPA needs no client secret.
   For local sign-in, the default `make dev` URL is `http://127.0.0.1:5173`;
   add that URL and its `/blank.html` path through the app manifest because
   the portal's redirect-URI text box rejects HTTP `127.0.0.1` loopback URIs.
2. Under **Expose an API**, set Application ID URI to `api://<client-id>` and
   add a delegated scope named `access_as_user` with **Who can consent** set to
   **Admins and users**. Set the access-token version to
   2 in the app manifest (`api.requestedAccessTokenVersion: 2`). Under **Token
   configuration**, add the optional `acct` claim to **access tokens**. The API
   denies tokens without `acct=0` (tenant member) or from another tenant.
3. Set GitHub Actions repository variables `ENTRA_TENANT_ID` to NTNU's tenant
   ID `09a10672-822f-4467-a5ba-5bb375967c05` and `ENTRA_CLIENT_ID` to the
   new application's client ID. They are identifiers, not secrets. Leave
   `ENTRA_ALLOWED_GROUP_ID` unset unless NTNU IT supplies a suitable group ID
   and configures its claim. Run **Deploy to Azure** after the registration is
   ready.

Ask one NTNU user to test sign-in after deployment. NTNU may allow
users to consent to this app, or its policy may require NTNU IT to grant admin
consent. Project owners cannot change that NTNU policy. If NTNU IT provides a
directory-managed group for the precise `@ntnu.no` audience, configure a
`groups` claim on access tokens and set `ENTRA_ALLOWED_GROUP_ID` to that group's
object ID. A missing or overage group claim then denies access. The Azure
deployment identity is a separate service principal from this user sign-in app.

The backend verifies Entra's token signature, issuer, audience, tenant, client,
scope, member status and optional group on every protected request. Microsoft
advises against using mutable email claims for authorization.

Until the new image and Entra settings are deployed, keep the old ingress IP
restriction active in Azure. The staged deployment will remove it only after
the authenticated image has been rolled out under the old rule.
An `RBAC: access denied` response before then is the Container Apps IP rule,
not Entra or Azure billing permissions. After deployment, a rejected sign-in
or API request produces an authentication error instead. See Microsoft's
[Container Apps IP restriction guide](https://learn.microsoft.com/en-us/azure/container-apps/ip-restrictions#access-denied)
and [Entra token claims guide](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation).

## Billing access

`enable_cost_reporting` defaults to `true`. Terraform gives each app a
dedicated user-assigned managed identity and grants **Cost Management Reader** at the
current subscription. This is read-only billing access; the service queries only
its configured resource IDs. Set the variable to `false` if you do not want the
role assignment or cost integration. Azure billing policies may additionally
restrict cost visibility for your subscription or agreement type.

The identity is created independently of the Container App. Role assignments use
its principal ID, while the app's `AZURE_CLIENT_ID` selects that identity for
`DefaultAzureCredential`. This avoids depending on a null system-assigned
principal ID when updating an existing app. Terraform manages these client IDs;
they are different from the GitHub deployment identity's `AZURE_CLIENT_ID`.
Deploying this change replaces each app's system-assigned identity with its
dedicated user-assigned identity and updates any existing billing role assignment.

The configured subscription is derived from the authenticated Terraform identity;
it must be the intended subscription (`7ec1bafb-324b-43b8-9c30-76e35b9d38cd` for
this project). Foundry resource IDs must be in that same subscription.

Terraform assembles the two app IDs, the registry and environment IDs, and any
`foundry_resource_ids`. It does not split shared Foundry costs across models.
Role propagation can take time after deployment; billing errors remain visible
and can be retried. Data is delayed and normally cached for 24 hours; the last
successful report may remain visible longer if Azure throttles requests. See
[measurement boundaries](architecture.md#billing-accuracy).

### CI fails with `roleAssignments/write` (403)

This means the GitHub deployment identity cannot grant the apps their billing
roles at subscription scope. Updating Container Apps and assigning Azure roles
require different permissions. The identity named in this error is the CI
service principal, not either app's managed identity.

An existing subscription Owner or authorized RBAC administrator must configure
this permission outside the application deployment:

1. Open the intended subscription in Azure Portal, then **Access control (IAM)**
   → **Add role assignment**.
2. Select **Role Based Access Control Administrator** under privileged roles.
3. Select the GitHub deployment service principal as the member. Match its
   **Object ID** to the error; for the reported deployment this is
   `96d6df9b-8e14-45c0-9c41-e73ae632526e`. This is not its application/client ID.
4. Under **Conditions**, restrict delegation using **Constrain roles and
   principals**: allow **Cost Management Reader** only for the user-assigned
   identities `ecocompute-autoscale` and `ecocompute-always-on` in the application
   resource group. This permits the billing assignments' creation and removal
   without granting CI unrestricted role administration. If these identities are
   later recreated, an administrator must update the allowed principal IDs.
5. Review and save. Allow permission propagation, then rerun **Deploy to Azure**
   so its Azure login obtains fresh credentials and Terraform can finish.

Use subscription scope because that is where this configuration grants billing
access; a resource-group-only grant does not authorize these assignments.
The mocked Terraform tests cannot verify the CI identity's live Azure permissions.
See Microsoft's [conditional role delegation guide](https://learn.microsoft.com/en-us/azure/role-based-access-control/delegate-role-assignments-portal).

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
terraform -chdir=infra/terraform/azure test
```

The Terraform tests mock Azure and check identity attachment, credential selection
and billing roles with reporting enabled and disabled. `make terraform-check`
runs these checks locally, and CI runs them before deployment.

Before a real plan/apply, run `terraform -chdir=infra/terraform/azure init` to
initialize the remote backend. Changing directory did not change resource
addresses or the state key. No Azure deployment is performed by application tests.
