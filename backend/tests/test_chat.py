from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from openai import APIError, APITimeoutError, RateLimitError
from pydantic import ValidationError

from app.core.errors import ServiceError
from app.schemas.chat import ChatRequest
from app.services.chat import FoundryChatService


def request(model="gpt-6-luna", backend="always-on"):
    return ChatRequest(
        model=model,
        backend=backend,
        messages=[
            {"role": "user", "content": "Remember the word green."},
            {"role": "assistant", "content": "I will."},
            {"role": "user", "content": "What was the word?"},
        ],
    )


def provider():
    return SimpleNamespace(
        responses=SimpleNamespace(
            create=AsyncMock(
                return_value=SimpleNamespace(
                    output_text="Green.",
                    status="completed",
                    usage=SimpleNamespace(
                        input_tokens=12,
                        output_tokens=3,
                        input_tokens_details=SimpleNamespace(cached_tokens=5),
                    ),
                )
            )
        )
    )


async def test_model_routing_history_and_usage(settings):
    luna, nano = provider(), provider()
    service = FoundryChatService(settings, {"gpt-6-luna": luna, "gpt-4.1-nano": nano})
    result = await service.reply(request())
    args = luna.responses.create.call_args.kwargs
    assert args["model"] == "luna-deployment"
    assert args["input"] == [message.model_dump() for message in request().messages]
    assert args["store"] is False
    assert result.input_tokens == 12 and result.output_tokens == 3 and result.cached_tokens == 5
    assert result.backend == "always-on" and result.model == "gpt-6-luna"
    nano.responses.create.assert_not_called()


async def test_wrong_backend_never_calls_foundry(settings):
    client = provider()
    with pytest.raises(ServiceError) as failure:
        await FoundryChatService(settings, {"gpt-6-luna": client}).reply(request(backend="autoscale"))
    assert failure.value.status_code == 409
    client.responses.create.assert_not_called()


async def test_missing_model_does_not_fall_back(settings):
    disabled = replace(settings.models[1], deployment="")
    settings = replace(settings, models=(settings.models[0], disabled))
    with pytest.raises(ServiceError) as failure:
        await FoundryChatService(settings, {}).reply(request())
    assert failure.value.status_code == 503


@pytest.mark.parametrize(
    "error,status",
    [
        (APITimeoutError(request=httpx.Request("POST", "https://example.test")), 504),
        (
            RateLimitError(
                "private detail",
                response=httpx.Response(429, request=httpx.Request("POST", "https://example.test")),
                body=None,
            ),
            429,
        ),
        (
            APIError(
                "secret-key private detail", request=httpx.Request("POST", "https://example.test"), body=None
            ),
            502,
        ),
    ],
)
async def test_provider_errors_are_safe(settings, error, status):
    client = provider()
    client.responses.create.side_effect = error
    with pytest.raises(ServiceError) as failure:
        await FoundryChatService(settings, {"gpt-6-luna": client}).reply(request())
    assert failure.value.status_code == status
    assert "private detail" not in failure.value.message and "secret-key" not in failure.value.message


async def test_missing_usage_is_unknown_not_zero(settings):
    client = provider()
    client.responses.create.return_value.usage = None
    response = await FoundryChatService(settings, {"gpt-6-luna": client}).reply(request())
    assert response.input_tokens is None and response.output_tokens is None


@pytest.mark.parametrize(
    "messages",
    [
        [{"role": "system", "content": "invalid role"}],
        [{"role": "user", "content": " "}],
        [{"role": "assistant", "content": "invalid order"}],
        [{"role": "user", "content": "x" * 8001}],
        [{"role": "user", "content": "a"}, {"role": "user", "content": "b"}],
    ],
)
def test_conversation_validation(messages):
    with pytest.raises(ValidationError):
        ChatRequest(model="gpt-4.1-nano", backend="autoscale", messages=messages)
