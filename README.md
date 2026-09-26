# EcoCompute

A small FastAPI backend that calls our `gpt-4.1-nano` deployment in Microsoft
Foundry. Azure network infrastructure lives in `julian_magnus/`.

## Run locally

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/getting-started/installation/).
From the repository root:

```sh
uv venv
uv pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in `AZURE_OPENAI_API_KEY`. The endpoint and
deployment name are already filled in. The deployment name must match the name in
Foundry; update it if your deployment uses a different name. Terraform variables
can stay empty when running the API locally.

Start the API:

```sh
uv run uvicorn main:app --reload
```

Open http://127.0.0.1:8000/docs, expand `POST /chat`, click **Try it out**, and send:

```json
{"prompt": "Explain serverless computing in one sentence."}
```

The response is `{"reply": "..."}`. Each request calls Foundry and can incur model
usage charges. The API limits the prompt to 8,000 characters and the response to
512 output tokens. It uses the Azure OpenAI v1 endpoint; the Foundry project
endpoint is not needed for these model calls.

The service is a local starting point with no user authentication. Keep it local
or behind authenticated/private ingress when hosting it.

## Environment variables and GitHub Secrets

| Variable | Value |
| --- | --- |
| `AZURE_OPENAI_BASE_URL` | `https://ecollm.openai.azure.com/openai/v1/` |
| `AZURE_OPENAI_API_KEY` | The resource API key from Foundry |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-4.1-nano` (the deployment name) |

Locally, put these values in `.env`. That file is ignored by Git. Existing process
environment variables take precedence over `.env`. Keep the API key on the
backend; never put it in browser code.

**GitHub Secrets work for GitHub Actions, but do not automatically become local
or deployed application environment variables.** When a workflow needs to run
this API, create repository secrets under **Settings > Secrets and variables >
Actions** and explicitly map them in the relevant step:

```yaml
env:
  AZURE_OPENAI_BASE_URL: ${{ secrets.AZURE_OPENAI_BASE_URL }}
  AZURE_OPENAI_API_KEY: ${{ secrets.AZURE_OPENAI_API_KEY }}
  AZURE_OPENAI_DEPLOYMENT: ${{ secrets.AZURE_OPENAI_DEPLOYMENT }}
```

All three can be Secrets, although only the API key is confidential. When hosting
the backend, configure these environment variables on that hosting service.

The existing Terraform workflow provisions and then destroys network resources
on pushes to `main`. It does **not** deploy this API or pass it Foundry credentials.

References: [Microsoft's Azure OpenAI v1 examples](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle),
[GitHub's Secrets documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).
