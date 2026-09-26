# EcoCompute

A small API that sends prompts to `gpt-4.1-nano` in Microsoft Foundry.

## Run locally

You need Python 3.12+ and [uv](https://docs.astral.sh/uv/getting-started/installation/).

Copy `.env.example` to `.env` and add your API key. The endpoint and model
deployment name are already set. Leave the Terraform variables empty for now.

```sh
uv venv
uv pip install -r requirements.txt
uv run uvicorn main:app --reload
```

Open http://127.0.0.1:8000/docs and try `POST /chat`:

```json
{"prompt": "What is serverless computing?"}
```

The response is `{"reply": "..."}`.

Keep the API key in `.env`, which is ignored by Git. GitHub Actions secrets do
not replace your local `.env`.

This API has no login. Use it locally until access control is added.
