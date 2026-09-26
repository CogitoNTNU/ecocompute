# Azure

Terraform creates two Container Apps:

| App | Replicas |
| --- | --- |
| `ecocompute-autoscale` | 0–3 |
| `ecocompute-always-on` | 1 |

Both apps use the same Docker image, CPU and memory.

## Deploy

1. Merge the branch into `main`.
2. Go to **Settings > Secrets and variables > Actions** in GitHub.
3. Add these secrets:
   - `AZURE_CLIENT_ID`
   - `TF_VAR_TENANT_ID`
   - `TF_VAR_SUBSCRIPTION_ID`
   - `AZURE_OPENAI_API_KEY`
4. Add these variables:
   - `AZURE_RESOURCE_GROUP`: name of the resource group
   - `ALLOWED_IP_CIDR`: your public IP address followed by `/32`
5. Go to **Actions > Deploy to Azure > Run workflow**.

The app URLs are shown at the end of the workflow. Add `/docs` to a URL to test
the API.

## Compare

Send the same traffic to both apps. In Azure, use **Metrics** to compare replicas
and response time. Use **Cost Management** to compare cost.

The autoscaling app can reach zero replicas after it has been idle. Its first
request may therefore be slower. Foundry usage is billed separately.
