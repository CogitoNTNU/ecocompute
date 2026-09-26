import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from openai import APIError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel, ConfigDict, Field

load_dotenv()


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.deployment = required_env("AZURE_OPENAI_DEPLOYMENT")
    async with AsyncOpenAI(
        base_url=required_env("AZURE_OPENAI_BASE_URL"),
        api_key=required_env("AZURE_OPENAI_API_KEY"),
        timeout=30.0,
        max_retries=0,
    ) as client:
        app.state.foundry = client
        yield


app = FastAPI(title="EcoCompute", lifespan=lifespan)


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    prompt: str = Field(min_length=1, max_length=8000)


@app.post("/chat")
async def chat(body: ChatRequest) -> dict[str, str]:
    try:
        response = await app.state.foundry.responses.create(
            model=app.state.deployment,
            input=body.prompt,
            max_output_tokens=512,
            store=False,
        )
    except APITimeoutError:
        raise HTTPException(504, "Foundry timed out. Try again later.") from None
    except RateLimitError:
        raise HTTPException(429, "Foundry is rate limited. Try again later.") from None
    except APIError:
        raise HTTPException(502, "Foundry could not complete the request.") from None

    if not response.output_text:
        raise HTTPException(502, "Foundry returned no text.")
    return {"reply": response.output_text}
