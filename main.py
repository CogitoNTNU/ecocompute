"""Minimal FastAPI backend for the existing Microsoft Foundry deployment."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from openai import APIError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel, ConfigDict, Field

load_dotenv(Path(__file__).with_name(".env"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    names = ("AZURE_OPENAI_BASE_URL", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT")
    config = {name: os.getenv(name, "").strip() for name in names}
    missing = [name for name, value in config.items() if not value]
    if missing:
        raise RuntimeError("Set these variables in .env or the environment: " + ", ".join(missing))

    app.state.deployment = config["AZURE_OPENAI_DEPLOYMENT"]
    async with AsyncOpenAI(
        base_url=config["AZURE_OPENAI_BASE_URL"].rstrip("/") + "/",
        api_key=config["AZURE_OPENAI_API_KEY"],
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
async def chat(body: ChatRequest, request: Request) -> dict[str, str]:
    try:
        response = await request.app.state.foundry.responses.create(
            model=request.app.state.deployment,
            input=body.prompt,
            max_output_tokens=512,
            store=False,
        )
    except APITimeoutError:
        raise HTTPException(504, "Foundry timed out. Try again later.") from None
    except RateLimitError:
        raise HTTPException(429, "Foundry is rate limited. Try again later.") from None
    except APIError:
        # Keep upstream error bodies and credentials out of the API response.
        raise HTTPException(502, "Foundry could not complete the request.") from None

    if not response.output_text:
        raise HTTPException(502, "Foundry returned no text.")
    return {"reply": response.output_text}
