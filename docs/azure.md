# Run in Azure

Terraform creates two apps using the same image and Consumption plan:

| App | Minimum replicas | Maximum replicas |
| --- | --- | --- |
| `ecocompute-autoscale` | 0 | 3 |
| `ecocompute-always-on` | 1 | 1 |

Both get 0.25 vCPU and 0.5 GiB RAM. The autoscaling app uses an HTTP rule with a
threshold of 10 concurrent requests. This measures requests, not logged-in users.
The app can stop when idle; the first request after that may take longer.

## Deploy

1. Merge this branch into `main`. Deployment is now manual; merging does not
   create or delete Azure resources.
2. In GitHub, open **Settings > Secrets and variables > Actions**. Set these
   repository secrets (the first three are already used by the Terraform setup):

   | Secret | Value |
   | --- | --- |
   | `AZURE_CLIENT_ID` | The existing Azure deployment identity |
   | `TF_VAR_TENANT_ID` | Your Azure tenant ID |
   | `TF_VAR_SUBSCRIPTION_ID` | Your Azure subscription ID |
   | `AZURE_OPENAI_API_KEY` | Your Foundry API key |

3. On the **Variables** tab, add:

   | Variable | Value |
   | --- | --- |
   | `AZURE_RESOURCE_GROUP` | The resource group managed by this Terraform setup |
   | `ALLOWED_IP_CIDR` | Your test machine's public IPv4 address followed by `/32` |

   The API has no login, so only this IP/range can call it. Update the variable
   and redeploy if your IP changes. Use the load generator's IP when load testing.
4. Check `location` in `julian_magnus/terraform.tfvars`. It is currently
   `australiaeast`. Both apps use this region. Changing it can replace existing
   Terraform resources, so choose it before the first deployment.
5. Open **Actions > Deploy to Azure > Run workflow** and choose `main`.
6. Open the two URLs in **Show app URLs**. Append `/docs` to test `/chat`.

The workflow creates the registry, builds the image, then deploys both apps.
Nothing is automatically destroyed afterwards. Every run creates a new image
tag so both apps receive the same build.

This uses the existing Azure OIDC login and remote state in `providers.tf`.
The deployment identity must be trusted for this repo's `main` branch, be able
to create resources and push images, and have permission to assign the `AcrPull`
role to the apps' identity. It also needs access to the state storage. The
Foundry key is stored in Terraform state as well as Container Apps Secrets;
keep access to the state storage restricted.

## Compare costs

Run the same requests against each app for the same period, including periods
with no traffic. Compare response times and successful requests as well as cost.
Use a load both apps can handle when comparing cost for the same work.

- **Monitoring > Metrics:** watch replica count, requests and response time.
- **Cost Management > Cost analysis:** filter to the two apps and group by
  resource. Billing data is delayed; it is not a live meter.
- `/health` returns a small response without calling Foundry. Use `/chat` for
  a test that includes real model calls. These are different workloads.
- Stop sending requests when testing scale to zero, including external health
  polling. Scale-down takes time; it is not immediate.

At zero replicas, the app has no compute usage charge. The always-on app may
get a reduced idle rate. Shared free allowances can make a small test look free,
so record replica counts too. Registry, Foundry and any other Azure costs are
separate from the two apps' compute costs.

To change the autoscaling limit, set `max_replicas` in
`julian_magnus/terraform.tfvars` and run the workflow again. The baseline stays
at one replica. When the experiment ends, remove its resources deliberately;
the always-on app and registry keep incurring usage while they exist.

Sources: [scaling](https://learn.microsoft.com/en-us/azure/container-apps/scale-app),
[billing](https://learn.microsoft.com/en-us/azure/container-apps/billing).
